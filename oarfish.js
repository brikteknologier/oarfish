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

var async = require('async');
function add(next) {
  core.addTrigger("job#37", "complacent", JSON.stringify("payload yo"),
                  "http://localhost:3333", next);
}
function complete(next) {
  core.updateStatus("job#37", "complete", next);
}
function complacent(next) {
  core.updateStatus("job#37", "complacent", next);
}

async.series([add, complete, complacent], function(err) { if (err) console.log(err); });
