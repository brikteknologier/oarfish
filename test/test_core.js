var assert = require('assert');
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;
var coreInit = require('../core');

describe("core", function() {
  var core;

  before(function() {
    var db = redis.createClient();
    var emitter = new EventEmitter();
    core = coreInit(db, emitter);
  });

  after(function() {
    core.end();
  });

  it("exists", function() {
    assert(core, "core not initialized");
  });
});
