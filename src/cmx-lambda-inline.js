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
 * Example CMX Post URL:
 *
 * https://lexffffff.execute-api.eu-west-1.amazonaws.com/prod/cmxreceiver-dynamodb/?network=London
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
    //console.log('Received context:', JSON.stringify(context, null, 2));

    // URL defined paramaters. Use this section to specify a source network or other attributes
    var network = "undefined";
    if (event.queryStringParameters){
        network = event.queryStringParameters.network;
    }

    var sourceIP = "undefined";
    if (event.requestContext){
        sourceIP = event.requestContext.identity.sourceIp;
    }

    // Handle the HTTP method
    switch (event.httpMethod) {
        case 'GET':
            console.log("sending validator: "+validator+" to Network "+network);
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
            console.log("received CMX POST: " + event.body + " from Network "+network);
            var cmxJSON = JSON.parse(event.body)
            //console.log("cmxJSON object: " + JSON.stringify(cmxJSON, null, 2));
            if(cmxJSON.secret != secret){
                //console.log("secret invalid: "+ cmxJSON.secret);
                console.log("secret invalid from: "+ sourceIP);
                callback(null, {
                statusCode: '403',
                body: "INVALID SECRET",
                headers: {
                    'Content-Type': 'text/plain',
                }
            });
                return;
            }else{
                //console.log("secret accepted: "+ cmxJSON.secret);
                console.log("secret accepted from: "+ sourceIP);
            }

            // Check CMX JSON Version
            if (cmxJSON['version'] != '2.0'){
                // Prevent invalid version JSON from being sent. This is to avoid changes in schema which could result in data corruption.
                console.log("CMX Receiver is written for version 2.0 and will not accept other versions. The POST data was sent with version: "+ cmxJSON['version']);
                return;
            }else{
                console.log("working with correct version: "+cmxJSON['version']);
            }


            // Define paramaters for DynamoDB
            var params = {
                "TableName" : dynamoTable
                }
                params.Item = {};

            // Loop through the JSON object and add each observation to DynamoDB schema

            console.log('cmxJSON.data.apMac = '+cmxJSON.data['apMac']);
            if(cmxJSON['type'] == "DevicesSeen"){
                console.log("type: DevicesSeen");
                var o = cmxJSON['data']['observations'];
                for (var key in o){
                    if (o.hasOwnProperty(key)) {
                        //console.log("Key is " + c + ", value is " + o[c].location.lat);
                        if (!o[key]['location']){break};
                        if (o[key]['seenEpoch'] === null || o[key]['seenEpoch'] === 0){break};//  # This probe is useless, so ignore it
                        params.Item.type = cmxJSON['type'];
                        params.Item.network = network;
                        params.Item.message_id = guid();
                        params.Item.message_ts = datetime.toString();
                        params.Item.name = o[key]['clientMac'];
                        params.Item.clientMac = o[key]['clientMac'];
                        params.Item.lat = o[key]['location']['lat'];
                        params.Item.lng = o[key]['location']['lng'];
                        params.Item.x = o[key]['location']['x'][0];
                        params.Item.y = o[key]['location']['y'][0];
                        params.Item.unc = o[key]['location']['unc'];
                        params.Item.seenString = o[key]['seenTime'];
                        params.Item.seenEpoch = o[key]['seenEpoch'];
                        params.Item.apFloors = cmxJSON['data']['apFloors'] || 0;
                        params.Item.manufacturer = o[key]['manufacturer'] || "unknown";
                        params.Item.os = o[key]['os'] || "unknown";
                        params.Item.ssid = o[key]['ssid'] || "not connected";
                        params.Item.ipv4 = o[key]['ipv4'] || "unknown";
                        params.Item.ipv6 = o[key]['ipv6'] || "unknown";
                        params.Item.apMac = cmxJSON['data']['apMac'];
                        params.Item.apTags = cmxJSON['data']['apTags'].toString() || "none";
                    }
                    // Put Item in DynamoDB
                    dynamo.put(params, function(err, body) {
                       if (err) {
                           console.log(err);
                           context.fail('error','Insert failed: '+err);
                       }
                       else {
                           console.log("DynamoDB insert SUCCESS!"+JSON.stringify(params, null, '  '));
                           context.succeed('SUCCESS');
                       }
                    });
                }  // end for loop
            }else if(cmxJSON['type'] == "BluetoothDevicesSeen"){
                console.log("type: BluetoothDevicesSeen");
                var o = cmxJSON['data']['observations'];
                for (var key in o){
                    if (o.hasOwnProperty(key)) {
                        //console.log("Key is " + c + ", value is " + o[c].location.lat);
                        if (!o[key]['location']){break};
                        if (o[key]['seenEpoch'] === null || o[key]['seenEpoch'] === 0){break};//  # This probe is useless, so ignore it
                        params.Item.type = cmxJSON['type'];
                        params.Item.message_id = guid();
                        params.Item.message_ts = datetime.toString();
                        params.Item.network = network;
                        params.Item.name = o[key]['clientMac'];
                        params.Item.clientMac = o[key]['clientMac'];
                        params.Item.lat = o[key]['location']['lat'];
                        params.Item.lng = o[key]['location']['lng'];
                        params.Item.x = o[key]['location']['x'][0];
                        params.Item.y = o[key]['location']['y'][0];
                        params.Item.unc = o[key]['location']['unc'];
                        params.Item.seenString = o[key]['seenTime'];
                        params.Item.seenEpoch = o[key]['seenEpoch'];
                        params.Item.apFloors = cmxJSON['data']['apFloors'] || 0;
                        params.Item.rssi = o[key]['rssi'];
                        params.Item.apMac = cmxJSON['data']['apMac'];
                        params.Item.apTags = cmxJSON['data']['apTags'].toString() || "none";
                    }
                } // end for loop
            }else{
                console.log("unknown CMX 'type'");
                break;
            }

            // Respond to client with success
            callback(null, {
                statusCode: '200',
                body: "CMX POST RECEIVED",
                headers: {
                    'Content-Type': 'text/plain',
                }
            });
        break;


        default:
            // Respond to client with failure
            callback(null, {
                    statusCode: '403',
                    body: "request not recognized",
                    headers: {
                        'Content-Type': 'text/plain',
                    }
                });
        }
};


// Helper function to define a unique GUID
function guid() {
 function s4() {
   return Math.floor((1 + Math.random()) * 0x10000)
     .toString(16)
     .substring(1);
 }
 return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
   s4() + '-' + s4() + s4() + s4();
}
