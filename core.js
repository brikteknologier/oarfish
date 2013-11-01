var async = require('async');
var EventEmitter = require('events').EventEmitter;

var day = 60 * 60 * 24;
var retainSec = 14 * day;
var retryNotifyMSec = 3 * 60 * 1000;

/*
 * "notify" must be an asynchronous function (emitter, trigger, next).  The emitter must
 * be used to emit 'log' events, and the trigger object must be of the form:
 * { job: <job id>,
 *   trigger: <job status causing the trigger>,
 *   url: <where to send the notification>,
 *   json: <data to send as the request> }
 */
function init(redisClient, notify, retryNotifyMSecOverride) {
  if (retryNotifyMSecOverride != undefined)
    retryNotifyMSec = retryNotifyMSecOverride;

  var db = redisClient;
  var emitter = new EventEmitter();
  var stopped = false;

  function addTrigger(jobId, triggerStatus, sendJson, sendUrl, next) {
    var triggerObject = {
      job: jobId,
      trigger: triggerStatus,
      json: sendJson,
      url: sendUrl };
    var triggerJson = JSON.stringify(triggerObject);
    emitter.emit("log", "Adding trigger: " + triggerJson);
    db.zadd("triggers", Date.now(), triggerJson, next);
    db.zremrangebyscore("triggers", "-inf", Date.now() - 1000 * retainSec);
    tryTrigger(jobId);
  }
  
  function _tryTrigger(jobId, next) {
    emitter.emit("log", "Checking if job " + jobId + " can be triggered");
    function triggers(next) {
      db.zrange("triggers", 0, -1, next);
    }
    function jobStatus(next) {
      db.get("job_" + jobId, next);
    }
    function doTrigger(next, res) {
      function notifyAndDelete(trigger, redisMember) {
        notify(emitter, trigger, function(err) {
          if (err) {
            emitter.emit("log", "Could not send trigger for " + jobId +
                         " to recipient.  Trying again in " + (retryNotifyMSec / 60000) +
                         " minutes.");
            setTimeout(
              function() {
                if (!stopped)
                  notifyAndDelete(trigger, redisMember);
              },
              retryNotifyMSec);                       
            return;
          }
          emitter.emit("log", "Notification successful. Deleting spent trigger for job " +
                       jobId);
          db.zrem("triggers", redisMember);
        });
      }
      var triggers = res.triggers;
      emitter.emit("log", "Job " + jobId + " has status " + res.jobStatus +
                   ". Looking for matching triggers...");
      for (var i = triggers.length - 1; i >= 0; i--) {
        var trigger = JSON.parse(triggers[i]);
        emitter.emit("log", " - found trigger for status " + trigger.trigger);
        if (trigger.job == jobId &&
            trigger.trigger == res.jobStatus)
          notifyAndDelete(trigger, triggers[i]);
      }
      emitter.emit("log", "...done");
      next();
    }
    async.auto({
      triggers: triggers,
      jobStatus: jobStatus,
      doTrigger: ["triggers", "jobStatus", doTrigger]
    }, next);
  }
  
  var triggerQueue = async.queue(_tryTrigger, 1);
  function tryTrigger(jobId) {
    triggerQueue.push(jobId, function pushed(err){
      if (err)
        emiiter.emit("log", "tryTrigger failed: " + JSON.stringify(err));
    });
  }

  function updateStatus(jobId, status, next) {
    emitter.emit("log", "Updating job " + jobId + " status: " + status);
    db.setex("job_" + jobId, retainSec, status, function(err) {
      if (err) return next(err);
      tryTrigger(jobId);
      next();
    });
  }

  function tryTriggerAll() {
    db.keys("job_*", function(err, keys) {
      if (err) {
        emitter.emit("log", "Could not retrieve all job ids: " + err);
        return;
      }
      emitter.emit("log", "Checking all " + keys.length + " jobs for triggering");
      keys.forEach(function(key) {
        var jobId = key.slice(4);
        tryTrigger(jobId);
      });
    });
  }

  function end() {
    stopped = true;
    emitter.emit("log", "Closing database connection.");
    db.end();
  }

  emitter.updateStatus = updateStatus;
  emitter.end = end;
  emitter.addTrigger = addTrigger;

  process.nextTick(tryTriggerAll);

  return emitter;
}

module.exports = init;
