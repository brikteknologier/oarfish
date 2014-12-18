var async = require("async");
var express = require('express');
var http = require('http');
var url = require('url');
var redis = require('redis');
var coreInit = require('./core');
var amazonListenerInit = require('./amazon-listener');

module.exports = function extractOrangeJuice(config, next) {
  function notify(emitter, trigger, next) {
    emitter.emit("log", "Notifying job " + trigger.job + " status " + trigger.trigger +
                 " to " + trigger.url);
    var opts = url.parse(trigger.url);
    opts.method = "POST";
    var req = http.request(opts, function(res) {
      if (res.statusCode < 200 || res.statusCode > 299)
        return next("Did not get 2XX reply from " + trigger.url);
      next();
    });
    req.on('error', next);
    req.end('boop');
  }
  
  var logger = console.log;
  
  function initRedis(next) {
    var client = redis.createClient(config.redis.port, config.redis.host);
    client.on('ready', function() {
      next(null, client);
    });
  }

  function initCore(redisClient, next) {
    var core = coreInit(redisClient, notify);
    core.on('log', logger);
    next(null, core);
  }

  function initEndpoints(core, next) {
    var amazonListener = amazonListenerInit(core.updateStatus);
    amazonListener.on('log', logger);
  
    var app = express();
    app.use(express.bodyParser());
  
    app.post('/subscribe/:jobid/:status', function(req, res, next) {
      var type = req.get('Content-Type');
      if (type != 'application/json')
        return next("Body data must be application/json");
      core.addTrigger(
        req.params.jobid,
        req.params.status,
        req.body.url,
        function(err) {
          if (err) return next(err);
          res.send("OK");
        }
      );
    });

    app.get('/triggers', function(req, res, next) {
      core.readTriggers(
        function(err, status) {
          if (err) return next(err);
          if (status == null)
            return res.status(404).send('¯\\(o_°)/¯');
          res.send(status);
        }
      );
    });
    
    app.get('/status/:jobid', function(req, res, next) {
      core.readStatus(
        req.params.jobid,
        function(err, status) {
          if (err) return next(err);
          if (status == null)
            return res.status(404).send('¯\\(°_o)/¯');
          res.send(status);
        }
      );
    });
  
    app.post('/notify', amazonListener.handlePost);

    next(null, app);
  }

  async.waterfall([initRedis, initCore, initEndpoints], next);
}
