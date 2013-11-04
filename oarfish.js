var express = require('express');
var http = require('http');
var url = require('url');
var coreInit = require('./core');
var redis = require('redis');

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

var core = coreInit(redis.createClient(), notify);
core.on("log", function(msg) {
  console.log(msg);
});

var app = express();
app.use(express.bodyParser());

app.post('/subscribe/:jobid/:status', function(req, res, next) {
  var type = req.get('Content-Type');
  if (type != 'application/json')
    return next("Body data must be application/json");
  console.log(req.body);
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

app.listen(9444);