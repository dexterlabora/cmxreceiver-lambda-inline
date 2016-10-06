/**
 * Cisco Meraki CMX Receiver to DynamoDB
 *
 * This inline AWS Lambda function will act as a Meraki CMX receiver.
 * The receiver will first respond to a GET request, sending the validator key to Meraki
 * Once validated, Meraki will perodically (30-60 seconds) send a JSON message containing WiFi and/or BLE observations
 * The data will then be parsed and placed into a DynamoDB table
 *
 * Now with BLE support!!
 *
 * Written by Cory Guynn
 * 2016
 * www.InternetOfLEGO.com
 * developers.meraki.com
 *
 */
'use strict';


// ******* ENTER YOUR CREDENTIALS **********

var secret = "enterYourSecret"; //"enterYourSecret";
var validator = "enterYourValidator";//"enterYourValidator";
var dynamoTable = "cmxdata";

// *****************************************
var datetime = new Date().getTime();

console.log('Loading function');

//const doc = require('dynamodb-doc');
const AWS = require('aws-sdk');

//const dynamo = new doc.DynamoDB();
const dynamo = new AWS.DynamoDB.DocumentClient();



exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    switch (event.httpMethod) {
        case 'GET':
            console.log("sending validator: "+validator);
            callback(null, {
                statusCode: '200',
                body: validator,
                headers: {
                    'Content-Type': 'text/plain',
                }
            });
            //dynamo.scan({ TableName: event.queryStringParameters.TableName }, done);
        break;

        case 'POST':
            console.log("received CMX POST: " + event.body);
            var cmxJSON = JSON.parse(event.body)
            //console.log("cmxJSON object: " + JSON.stringify(cmxJSON, null, 2));
            if(cmxJSON.secret != secret){
                console.log("secret invalid");
                callback(null, {
                statusCode: '403',
                body: "INVALID SECRET",
                headers: {
                    'Content-Type': 'text/plain',
                }
            });
            //dynamo.s
                //break;
                return;
            }else{
                console.log("secret accepted: "+ cmxJSON.secret);
            }


            if (cmxJSON['version'] != '2.0'){
                console.log("got post with unexpected version: "+ cmxJSON['version']);
                return;
            }else{
                console.log("working with correct version: "+cmxJSON['version']);
            }

            // Loop through JSON object and add each observation to the DB
            var params = {
                "TableName" : dynamoTable
                }
                params.Item = {};


            var o = cmxJSON['data']['observations'];
            console.log('cmxJSON.data.apMac = '+cmxJSON.data['apMac']);
            for (var key in o){
                if(cmxJSON['type'] == "DevicesSeen"){
                    console.log("DevicesSeen");
                    if (o.hasOwnProperty(key)) {
                        //console.log("Key is " + c + ", value is " + o[c].location.lat);
                        if (!o[key]['location']){break};
                        if (o[key]['seenEpoch'] === null || o[key]['seenEpoch'] === 0){break};//  # This probe is useless, so ignore it
                        params.Item.message_id = guid();
                        params.Item.message_ts = datetime.toString();
                        params.Item.name = o[key]['clientMac'];
                        params.Item.clientMac = o[key]['clientMac'];
                        params.Item.lat = o[key]['location']['lat'];
                        params.Item.lng = o[key]['location']['lng'];
                        params.Item.x = o[key]['location']['lat'];
                        params.Item.y = o[key]['location']['x'][0];
                        params.Item.unc = o[key]['location']['y'][0];
                        params.Item.seenString = o[key]['seenTime'];
                        params.Item.seenEpoch = o[key]['seenEpoch'];
                        params.Item.apFloors = cmxJSON['data']['apFloors'] || 0;//=== null ? "" : cmxJSON['data']['apFloors'].join;
                        params.Item.manufacturer = o[key]['manufacturer'] || "unknown";
                        params.Item.os = o[key]['os'] || "unknown";
                        params.Item.ssid = o[key]['ssid'] || "not connected";
                        params.Item.ipv4 = o[key]['ipv4'] || "unknown";
                        params.Item.ipv6 = o[key]['ipv6'] || "unknown";
                        params.Item.apMac = cmxJSON['data']['apMac'];
                        params.Item.apTags = cmxJSON['data']['apTags'].toString() || "none";
                        console.log("AP :"+cmxJSON['data']['apMac']);

                    }
                }else if(cmxJSON['type'] == "BluetoothDevicesSeen"){
                    console.log("BluetoothDevicesSeen");
                    if (o.hasOwnProperty(key)) {
                        //console.log("Key is " + c + ", value is " + o[c].location.lat);
                        if (!o[key]['location']){break};
                        if (o[key]['seenEpoch'] === null || o[key]['seenEpoch'] === 0){break};//  # This probe is useless, so ignore it
                        params.Item.message_id = guid();
                        params.Item.message_ts = datetime.toString();
                        params.Item.name = o[key]['clientMac'];
                        params.Item.clientMac = o[key]['clientMac'];
                        params.Item.lat = o[key]['location']['lat'];
                        params.Item.lng = o[key]['location']['lng'];
                        params.Item.x = o[key]['location']['lat'];
                        params.Item.y = o[key]['location']['x'][0];
                        params.Item.unc = o[key]['location']['y'][0];
                        params.Item.seenString = o[key]['seenTime'];
                        params.Item.seenEpoch = o[key]['seenEpoch'];
                        params.Item.apFloors = cmxJSON['data']['apFloors'] || 0;//=== null ? "" : cmxJSON['data']['apFloors'].join;
                        params.Item.ssid = o[key]['rssi'];
                        params.Item.apMac = cmxJSON['data']['apMac'];
                        params.Item.apTags = cmxJSON['data']['apTags'].toString() || "none";
                        console.log("AP :"+cmxJSON['data']['apMac']);

                    }
                }else{
                    console.log("unknown CMX 'type'");
                    break;
                }

                //dynamo.putItem(params, function(err, body) {
                dynamo.put(params, function(err, body) {
                   if (err) {
                       console.log(err);
                       context.fail('error','Insert failed: '+err);
                   }
                   else {
                       //console.log('great success: '+JSON.stringify(body, null, '  '));
                       console.log("DynamoDB insert SUCCESS!"+JSON.stringify(params, null, '  '));
                       context.succeed('SUCCESS');
                   }
                });
                callback(null, {
                    statusCode: '200',
                    body: "CMX POST RECEIVED",
                    headers: {
                        'Content-Type': 'text/plain',
                    }
                });


            }
        break;


        default:
            callback(null, {
                    statusCode: '403',
                    body: "request not recognized",
                    headers: {
                        'Content-Type': 'text/plain',
                    }
                });
        }
};

function guid() {
 function s4() {
   return Math.floor((1 + Math.random()) * 0x10000)
     .toString(16)
     .substring(1);
 }
 return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
   s4() + '-' + s4() + s4() + s4();
}
