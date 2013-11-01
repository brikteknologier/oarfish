var assert = require('assert');
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;
var disposableRedis = require('disposable-redis');
var coreInit = require('../core');

describe("core", function() {
  var disposableClient;
  var core;

  var notifications = {};
  function onNotify(jobId, next) {
    notifications[jobId] = next;
  }
  function notifier(emitter, trigger, next) {
    if (!notifications[trigger.job])
      return next("no listeners");
    notifications[trigger.job](null, trigger);
    delete notifications[trigger.job];
    next();
  }

  before(function(next) {
    // First invocation of disposable-redis may need to download and build redis.
    this.timeout(10 * 60 * 1000);
    disposableRedis.client(function(err, result) {
      if (err) return next(err);
      core = coreInit(result.client, notifier);
      disposableClient = result;
      next();
    });
  });

  after(function() {
    core.end();
    disposableClient.close();
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
      assert.fail("Should not have received notification.");
    });

    var endpoint = "http://example.com/derp";
    var payload = JSON.stringify("importantjson");
    core.addTrigger("unimportantjob", "goodstatus", payload, endpoint, added);
    
    function added(err) {
      if (err) return next(err);
      core.updateStatus("importantjob", "badstatus", function(err) {
        if (err) return next(err);
      });
    }

    setTimeout(next, 100);
  });

  it("retries if notifiee not successfully notified", function(next) {
    assert.fail("test not implemented");
  });

  it("triggers when trigger added after status has been updated", function(next) {
    assert.fail("test not implemented");
  });

  it("remembers triggers after a restart", function(next) {
    assert.fail("test not implemented");
  });

  it("remembers job statuses after a restart", function(next) {
    assert.fail("test not implemented");
  });

  it("catches up on retries after a restart", function(next) {
    assert.fail("test not implemented");
  });
});
