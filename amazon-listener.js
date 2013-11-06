var EventEmitter = require('events').EventEmitter;

function createHandler(updateStatus) {
  var emitter = new EventEmitter();

  function handler(req, res, next) {
    var body = req.body;
    if (body == undefined)
      throw new Error("req.body not set.  express.bodyParser() not in use by app?");

    // Amazon SNS sends JSON body as ContentType=text/plain which
    // doesn't trigger body parsing.
    if (typeof body != 'object')
      body = JSON.parse(body);

    emitter.emit('log', "Notification received: " + body.Subject || body);
    var message = JSON.parse(body.Message);

    updateStatus(message.jobId, message.state, function(err) {
      if (err) return next(err);
      res.send(["KTHX","ASUM","OK","SWEET","K","LOL","GOOD","NOTED"][Date.now()%8]);
    });
  }

  emitter.handlePost = handler;

  return emitter;
}

module.exports = createHandler;
