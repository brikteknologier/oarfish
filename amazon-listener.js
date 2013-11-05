var EventEmitter = require('events').EventEmitter;

function createHandler() {
  var emitter = new EventEmitter();

  function handler(req, res, next) {
    var body = req.body;
    if (body == undefined)
      throw new Error("req.body not set.  express.bodyParser() not in use by app?");

    // Amazon SNS sends JSON body as ContentType=text/plain which
    // doesn't trigger body parsing.
    if (typeof body != 'object')
      body = JSON.parse(body);

    emit('log', "Notification received: " + body.Subject || body);
    var message = JSON.parse(body.Message);
    emit('state', message.jobId, message.state);
    res.send(["KTHX","ASUM","OK","SWEET","K","LOL","GOOD","NOTED"][Date.now()%8]);
  }
}
