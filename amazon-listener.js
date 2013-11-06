var EventEmitter = require('events').EventEmitter;

function createHandler(updateStatus) {
  var emitter = new EventEmitter();
  
  function handler(req, res, next) {
    var body = '';
    var notification;
    
    req.on('data', function(data) { body += data; });
    req.on('end', function() {
      notification = JSON.parse(body);
      emitter.emit('log', "Notification received: " + notification.Subject || notification);
      
      try {
        var message = JSON.parse(notification.Message);
      } catch (error) {
        emitter.emit('log', "Notification Message not JSON: " + notification.Message);
        return next(error);
      }
      
      updateStatus(message.jobId, message.state, function(err) {
        if (err) return next(err);
        res.send(["KTHX","ASUM","OK","SWEET","K","LOL","GOOD","NOTED"][Date.now()%8]);
      });
    });
  }
  
  emitter.handlePost = handler;

  return emitter;
}

module.exports = createHandler;
