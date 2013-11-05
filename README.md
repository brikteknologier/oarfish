# oarfish

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

## POST /notify

This is where all the AET pipeline's SNS topics should be pointed at.

Assumes it will be sent a POST with `text/plain` containing a JSON
encoded object containing at least the fields:

* `Type`: `"Notification"`
* `Subject`: Human-readable summary of notification.
* `Message`: JSON encoded transcoding job status.

An example notification request:

```
{
  "Type" : "Notification",
  "MessageId" : "61abfff2-e0dc-5616-85c8-b5002dde66f5",
  "TopicArn" : "arn:aws:sns:eu-west-1:289843397512:transcode-progress",
  "Subject" : "Amazon Elastic Transcoder has scheduled job 1383647937430-oycd3o for transcoding.",
  "Message" : "{\n  \"state\" : \"PROGRESSING\",\n  \"version\" : \"2012-09-25\",\n  \"jobId\" : \"1383647937430-oycd3o\",\n  \"pipelineId\" : \"1383647849582-ucoh9b\",\n  \"input\" : {\n    \"key\" : \"Wildlife.wmv\",\n    \"frameRate\" : \"auto\",\n    \"resolution\" : \"auto\",\n    \"aspectRatio\" : \"auto\",\n    \"interlaced\" : \"auto\",\n    \"container\" : \"auto\"\n  },\n  \"outputs\" : [ {\n    \"id\" : \"1\",\n    \"presetId\" : \"1351620000001-000040\",\n    \"key\" : \"out.mp4\",\n    \"thumbnailPattern\" : \"\",\n    \"rotate\" : \"auto\",\n    \"status\" : \"Progressing\"\n  } ]\n}",
  "Timestamp" : "2013-11-05T10:38:58.526Z",
  "SignatureVersion" : "1",
  "Signature" : "G7GoyHKqKrZe9M5WkyHu9baA4bY37qn0Ey78sTdlogvUQQlYxtnyakKCiXrYsD5rZ0ZdVygvbl9t7/ZDv59ItFCJgETjk7uoMhaSU7gjLGR+40KnV/AbIczd/yltW8yyX3xRUuWUuOypWxDHiwto0sDVadyJLr2fMSr5sTqThhxqviAQaZdBmpfk+aU9EOaJAYidmTSylVVymU9/Q2YKH5CYQejM9mbVnYkNBZcyWfL8TtJl2wRVIDs2mNX+KwmeztPmn6Cj9U1RQ9yuNni3novjUZXj14ReTB8NYFxr9YM9cvso7C00vuh+kAgWwwabkm/QQz7XHyuGRIPluibs1Q==",
  "SigningCertURL" : "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-e372f8ca30337fdb084e8ac449342c77.pem",
  "UnsubscribeURL" : "https://sns.eu-west-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:eu-west-1:289843397512:transcode-progress:0568882a-8809-4ee3-a9a5-2e40fdb8b54b"
}
```
