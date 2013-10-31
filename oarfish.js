var async = require('async');
var http = require('http');
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;

var day = 60 * 60 * 24;
var retainSec = 14 * day;
var retryNotifyMSec = 3 * 60 * 1000;

function init(logger) {
  var emitter = new EventEmitter();

  var db = redis.createClient();

  function notify(trigger, next) {
    emitter.emit("Notifying job " + trigger.job + " status " + trigger.trigger +
                 " to " + trigger.url);
    var opts = url.parse(trigger.url);
    opts.method = "POST";
    opts.headers = { "Content-Type": "application/json" };
    var req = http.request(opts, function(res) {
      if (res.statusCode < 200 || res.statusCode > 299)
        return next("Did not get 2XX reply from " + trigger.url);
      next();
    });
    req.on('error', next);
    req.write(trigger.json);
    req.end();
  }

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
        notify(trigger, function(err) {
          if (err) {
            emitter.emit("log", "Could not send trigger for " + jobId +
                         " to recipient.  Trying again in " + (retryNotifyMSec / 60000) +
                         " minutes.");
            setTimeout(retryNotifyMSec, notifyTrigger(trigger, redisMember));
            return;
          }
          emitter.emit("log", "Deleting spent trigger for job " + jobId);
          db.zrem("triggers", redisMember);
        });
      }
      var triggers = res.triggers;
      for (var i = triggers.length - 1; i >= 0; i--) {
        var trigger = JSON.parse(triggers[i]);
        if (trigger.job == jobId &&
            trigger.status == jobStatus)
          notifyAndDelete(trigger, triggers[i]);
      }
    }
    async.auto({
      triggers: triggers,
      jobStatus: jobStatus,
      doTrigger: ["triggers", "jobStatus", doTrigger]
    }, next);
  }

  var triggerQueue = async.queue(_tryTrigger, 1);
  function tryTrigger(jobId) {
    triggerQueue.push(jobId, function ignore(){});
  }

  function updateStatus(jobId, status, next) {
    db.setex("job_", jobId, retainSec, status, function(err) {
      if (err) return next(err);
      emitter.emit("log", "Job " + jobId + " updated status: " + status);
      tryTrigger(jobId);
      next();
    });
  }

  function tryTriggerAll() {
    db.keys("job_*", function(err, keys) {
      if (err) {
        emitter.emit("Could not retrieve all job ids: " + err);
        return;
      }
      emitter.emit("Checking all " + keys.length + " jobs for triggering");
      keys.forEach(function(key) {
        var jobId = key.slice(4);
        tryTrigger(jobId);
      });
    });
  }

  function end() {
    emitter.emit("log", "Closing database connection.");
    db.end();
  }

  emitter.updateStatus = updateStatus;
  emitter.end = end;
  emitter.tryTriggerAll = tryTriggerAll;
  emitter.addTrigger = addTrigger;

  return emitter;
}
