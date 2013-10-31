var assert = require('assert');
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;
var disposableRedis = require('disposable-redis');
var coreInit = require('../core');

describe("core", function() {
  var disposableClient;
  var core;

  before(function(next) {
    var emitter = new EventEmitter();
    // First invocation of disposable-redis may need to download and build redis.
    this.timeout(10 * 60 * 1000);
    disposableRedis.client(function(err, result) {
      if (err) return next(err);
      core = coreInit(result.client, emitter);
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

});
