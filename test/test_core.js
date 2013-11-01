var assert = require('assert');
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;
var disposableRedis = require('disposable-redis');
var coreInit = require('../core');

describe("core", function() {
  var disposableServer;
  var core;

  var notifications = {};
  function onNotify(jobId, next) {
    notifications[jobId] = next;
  }
  function notifier(emitter, trigger, next) {
    if (!notifications[trigger.job])
      return next("no listeners");
    var callback = notifications[trigger.job];
    delete notifications[trigger.job];
    var errorIfAny = callback(null, trigger);
    next(errorIfAny);
  }

  before(function(next) {
    // First invocation of disposable-redis may need to download and build redis.
    this.timeout(10 * 60 * 1000);
    disposableRedis.server(function(err, server) {
      if (err) return next(err);
      disposableServer = server;
      var client = redis.createClient(disposableServer.port);
      core = coreInit(client, notifier, 10);
      next();
    });
  });

  after(function() {
    core.end();
    disposableServer.close();
  });

  it("exists", function() {
    assert(core, "core not initialized");
  });

  it("can register new triggers", function(next) {
    core.addTrigger("dummyjob", "dummystatus", '"dummyjson"', "http://example.com/", next);
  });

  it("can receive job status updates", function(next) {
    core.updateStatus("sillyjob", "sillified", next);
  });

  it("triggers when job status updates to desired state", function(next) {
    onNotify("importantjob", next);

    var endpoint = "http://example.com/derp";
    var payload = JSON.stringify("importantjson");
    core.addTrigger("importantjob", "importantstatus", payload, endpoint, added);
    
    function added(err) {
      if (err) return next(err);
      core.updateStatus("importantjob", "importantstatus", function(err) {
        if (err) return next(err);
      });
    }
  });
  
  it("sends correct payload on trigger", function(next) {
    onNotify("correctjob", notificationReceived);

    var endpoint = "http://example.com/derp";
    var payload = JSON.stringify("the very best of jsons");
    core.addTrigger("correctjob", "performed", payload, endpoint, added);
    
    function added(err) {
      if (err) return next(err);
      core.updateStatus("correctjob", "performed", function(err) {
        if (err) return next(err);
      });
    }

    function notificationReceived(err, trigger) {
      assert.equal(trigger.json, payload);
      next();
    }
  });

  it("does not trigger when job status updates to some other state", function(next) {
    onNotify("unimportantjob", function() {
      clearTimeout(successTimeout);
      next("Should not have received notification.");
    });

    var endpoint = "http://example.com/derp";
    var payload = JSON.stringify("importantjson");
    core.addTrigger("unimportantjob", "goodstatus", payload, endpoint, added);
    
    function added(err) {
      if (err) return next(err);
      core.updateStatus("unimportantjob", "badstatus", function(err) {
        if (err) return next(err);
      });
    }
    
    var successTimeout = setTimeout(next, 100);
  });

  it("retries if notifiee not successfully notified", function(next) {
    var registeredNegativeNotification = false;
    
    onNotify("stevejob", function() {
      onNotify("stevejob", function() {
        next();
      });
      return "Please try again.";
    });

    var endpoint = "http://example.com/derp";
    var payload = JSON.stringify("importantjson");
    core.addTrigger("stevejob", "iStatus", payload, endpoint, added);
    
    function added(err) {
      if (err) return next(err);
      core.updateStatus("stevejob", "iStatus", function(err) {
        if (err) next(err);
      });
    }
  });

  it("triggers when trigger added after status has been updated", function(next) {
    var endpoint = "http://example.com/derp";
    var payload = JSON.stringify("importantjson");
    core.addTrigger("billbob", "iStatus", payload, endpoint, added);
    
    function added(err) {
      if (err) return next(err);
      core.updateStatus("billbob", "iStatus", function(err) {
        if (err) next(err);
        setTimeout(addNotifiee, 10);
      });
    }

    function addNotifiee() {
      onNotify("billbob", function() {
        next();
      });
    }
  });

  it("remembers triggers after a restart", function(next) {
    onNotify("jobber", function() {
      next();
    });

    core.addTrigger("jobber", "drunk", "{}", "http://example.com", added);
    function added(err) {
      if (err) return next(err);
      core.end();
      core = coreInit(redis.createClient(disposableServer.port), notifier, 10);
      core.updateStatus("jobber", "drunk", function(){});
    }
  });

  it("remembers job statuses after a restart", function(next) {
    onNotify("jeb", function() {
      next();
    });
    
    core.updateStatus("jeb", "in space", function(err) {
      if (err) return next(err);
      core.end();
      core = coreInit(redis.createClient(disposableServer.port), notifier, 10);
      core.addTrigger("jeb", "in space", function(){});
    });
  });

  it("catches up on retries after a restart", function(next) {
    assert.fail("test not implemented");
  });
});
