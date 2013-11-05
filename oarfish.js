var express = require('express');
var http = require('http');
var url = require('url');
var redis = require('redis');
var coreInit = require('./core');
var amazonListenerInit = require('./amazon-listener');

function notify(emitter, trigger, next) {
  emitter.emit("log", "Notifying job " + trigger.job + " status " + trigger.trigger +
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

var logger = console.log;

var core = coreInit(redis.createClient(), notify);
core.on('log', logger);

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
    req.body.payload,
    req.body.url,
    function(err) {
      if (err) return next(err);
      res.send("OK");
    }
  );
});

app.get('/status/:jobid', function(req, res, next) {
  core.readStatus(
    req.params.jobid,
    function(err, status) {
      if (err) return next(err);
      res.send(status);
    }
  );
});

app.post('/notify', amazonListener.handlePost);

app.listen(9444);
