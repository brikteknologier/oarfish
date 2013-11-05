# oarfish

DOCUMENTATION NOT YET FINISHED

This is a web service designed to listen for incoming job status updates from Amazon Elastic
Transcoder, and send HTTP requests to other servers when certain job conditions are met.

It is designed to remember statuses and subscriber triggers for up to two weeks,
should not be affected by restarts, and will retry sending notifications until they
have been accepted.

# HTTP API

## POST /subscribe/:jobid/:status

Let oarfish know that you wish to be notified *once* with a POST message when the
corresponding job has the given status.

If the server at the notification URL does not respond with `2XX`, oarfish will retry every
few minutes for up to two weeks.

Body should be JSON with two fields:

* url - Where to send the notification.

Example:
```
{
  "url": "http://transcodingbunny.ru/jobComplete"
}
```

## PUT/POST/GET? /status?/help?/bunnies?

This is where Amazon Elastic Transcoder should be pointed at.

Will be documented when we get there.
