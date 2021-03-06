const express = require('express');
const app = express();
const Client = require('../models').Client;
const net = require('net');
const VT = String.fromCharCode(0x0b);
const FS = String.fromCharCode(0x1c);
const CR = String.fromCharCode(0x0d);
require('dotenv').config();
const remoteOptions = {host: process.env.REMOTE_IP, port: process.env.REMOTE_PORT};

module.exports = {
    push(req, res) {
        var client = Client.findOne({where: {uuid: req.params.ClientUuid}, logging: false });
        client.then(function (client) {
            // MSH Variables
            var p = "|";
            var h = "^";
            // var n = "\r\n"
            var MSHheader = "MSH|^~\\&";
            var SendingApplication = "CTC";
            var SendingFacility = "HIM";
            var ReceivingApplication = "NHCR";
            var ReceivingFacility = "NHCR";
            var Timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            var ColonTimestamp = Timestamp.replace(/-|\s/g,"")
            var MessageTimestamp = ColonTimestamp.replace(/:/g,"");
            var Token = process.env.TOKEN;
            var MSHsuffix = "ADT^A01^ADT_A01|8|P|2.3.1";

            // EVN Variables
            var EVNheader = "EVN";

            // PID Variables
            var PIDheader = "PID";
            var NewProgramID = client.ctc_id;
            var AuthApp = "CTC";
            var EncounterLoc = 100175;
            var LName = client.lastname;
            var FName = client.firstname;
            var MName = client.middlename;
            var OName = client.othername;
            var allDob = client.dob;
            var colonDob = allDob.replace(/-|\s/g,"");
            var DoB = colonDob.replace(/:/g,"").substr(0, 8);
            var Gender = client.sex == 'Female' ? 'F' :'M';
            var PermHamlet = client.hamlet;
            var PermCouncil = client.council;
            var PermWard = client.ward;
            var PermVillage = client.village;
            var PermDistrict = client.council;
            var PermRegion = client.region;
            var ResdHamlet = client.hamlet;
            var ResdCouncil = client.council;
            var ResdWard = client.ward;
            var ResdVillage = client.village;
            var ResdDistrict = client.council;
            var ResdRegion = client.region;
            var BirthHamlet = client.hamlet;
            var BirthCouncil = client.council;
            var BirthWard = client.ward;
            var BirthVillage = client.village;
            var BirthDistrict = client.council;
            var BirthRegion = client.region;
            var MobilePrefix = client.phone_prefix;
            var MobileSuffix = client.phone_suffix;
            var ULNumber = client.uln;
            var DLicense = client.dl_id;
            var NationalID = client.national_id;
            
            // PV headers
            var PVheader = "PV1";

            // IN headers
            var INheader = "IN1";
            var InsuranceID = client.nhif_id;
            var InsuranceType = "NHIF";

            // Z Headers
            // var Zheader = "ZXT";
            // var VotersID = client.voter_id;
            // var BirthCert = client.birth_certificate_entry_number;
            // var CountryCode = "TZA";
            // var CountryName = "Tanzania";
            
            // Create the message to be sent to the NHCR
            // +Zheader+p+VotersID+BirthCert+h+CountryCode+h+"BTH_CRT"+h+h+CountryName+p+p+p+"\r\n"
            const message = 
                MSHheader+p+SendingApplication+p+SendingFacility+p+ReceivingApplication+p+ReceivingFacility+p+MessageTimestamp+p+Token+p+MSHsuffix+"\r\n"+
                EVNheader+p+p+MessageTimestamp+"\r\n"+
                PIDheader+p+p+p+NewProgramID+h+h+h+AuthApp+h+h+EncounterLoc+p+p+LName+h+FName+h+MName+h+h+h+h+"L"+p+p+DoB+p+Gender+p+h+OName+p+p+PermHamlet+h+PermCouncil+"*"+PermWard+"*"+PermVillage+h+PermDistrict+h+PermRegion+h+h+h+"H~"+ResdHamlet+h+ResdCouncil+"*"+ResdWard+"*"+ResdVillage+h+ResdDistrict+h+ResdRegion+h+h+h+"C~"+BirthHamlet+h+BirthCouncil+"*"+BirthWard+"*"+BirthVillage+h+BirthDistrict+h+BirthRegion+h+h+h+"BR||^PRN^PH^^^^"+MobilePrefix+MobileSuffix+p+p+p+p+p+p+ULNumber+p+DLicense+p+p+p+p+p+p+p+p+NationalID+"\r\n"+
                PVheader+p+p+'I'+"\r\n"+
                INheader+p+p+InsuranceID+p+p+InsuranceType+"\r\n"
            ;

            // Send the client to NHCR using events
            const page = req.query.page || 2;
            const limit = 10;
            const offset = 10;
            const remote = net.createConnection(remoteOptions, () => {
                let reqdata = VT + message.replace(/ /g,"") + FS + CR
                console.log('Connected to HL7 server!');
                remote.write(new Buffer.from(reqdata, {encoding: "utf8"}));
            });
            remote.on('data', async (data) => {
                let ansData = data.toString();
                console.log(`HL7 ACK Message: ${ansData}\r\n`)
                await Client.update({status: 1}, {where: {uuid: req.params.ClientUuid}})
                .then(
                    // Define the page that loads paginated answers
                    // Client.findAndCountAll({
                    //     limit: limit,
                    //     offset: (page - 1) * offset,
                    //     order: [['id', 'ASC']],
                    //     where: { status: 0 },
                    // })
                    // // .then(res.redirect('/clients?page='+page))
                    // .then(res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0'))
                    //     .then (res.redirect('back'))
                    Client.findAndCountAll({
                        limit: limit,
                        offset: (page - 1) * offset,
                        order: [['id', 'ASC']],
                        // where: { status: 0 },
                    })
                    .then(clients => res.render('clients/index', {
                        "clients": clients.rows,
                        "pagesCount": Math.ceil(clients.count/limit),
                        "currentPage": page,
                    }))
                    .catch(error => res.status(400).send(error))
                ).then(remote.end());
                
            });
            remote.on('error', (err) => {
                var reqerror = `${new Date()} Problem with request: ${err.message}\r\n`;
                console.error(reqerror);
                remote.end();
                console.log(`Disconnected from HL7 server`);
            });
            remote.on('end', async () => {
                await console.log(`Disconnected from HL7 server and Updated client status`);
                remote.end();
            })
        })
    },

    pushAll(req, res) {
        clients = Client.findAll({where: { status: 0 }})
        .then( clients => {
            clients.forEach(client => {
                // MSH Variables
                var p = "|";
                var h = "^";
                // var n = "\r\n"
                var MSHheader = "MSH|^~\\&";
                var SendingApplication = "CTC";
                var SendingFacility = "HIM";
                var ReceivingApplication = "NHCR";
                var ReceivingFacility = "NHCR";
                var Timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                var ColonTimestamp = Timestamp.replace(/-|\s/g,"")
                var MessageTimestamp = ColonTimestamp.replace(/:/g,"");
                var MSHsuffix = "ADT^A01^ADT_A01|8|P|2.3.1";

                // EVN Variables
                var EVNheader = "EVN";

                // PID Variables
                var PIDheader = "PID";
                var NewProgramID = client.ctc_id;
                var AuthApp = "CTC";
                var EncounterLoc = 100175;
                var LName = client.lastname;
                var FName = client.firstname;
                var MName = client.middlename;
                var OName = client.othername;
                var allDob = client.dob;
                var colonDob = allDob.replace(/-|\s/g,"");
                var DoB = colonDob.replace(/:/g,"").substr(0, 8);
                var Gender = client.sex == 'Female' ? 'F' :'M';
                var PermHamlet = client.hamlet;
                var PermCouncil = client.council;
                var PermWard = client.ward;
                var PermVillage = client.village;
                var PermDistrict = client.council;
                var PermRegion = client.region;
                var ResdHamlet = client.hamlet;
                var ResdCouncil = client.council;
                var ResdWard = client.ward;
                var ResdVillage = client.village;
                var ResdDistrict = client.council;
                var ResdRegion = client.region;
                var BirthHamlet = client.hamlet;
                var BirthCouncil = client.council;
                var BirthWard = client.ward;
                var BirthVillage = client.village;
                var BirthDistrict = client.council;
                var BirthRegion = client.region;
                var MobilePrefix = client.phone_prefix;
                var MobileSuffix = client.phone_suffix;
                var ULNumber = client.uln;
                var DLicense = client.dl_id;
                var NationalID = client.national_id;
                
                // PV headers
                var PVheader = "PV1";

                // IN headers
                var INheader = "IN1";
                var InsuranceID = client.nhif_id;
                var InsuranceType = "NHIF";

                
                // Create the message to be sent to the NHCR
                const message = 
                    MSHheader+p+SendingApplication+p+SendingFacility+p+ReceivingApplication+p+ReceivingFacility+p+MessageTimestamp+p+p+MSHsuffix+"\r\n"+
                    EVNheader+p+p+MessageTimestamp+"\r\n"+
                    PIDheader+p+p+p+NewProgramID+h+h+h+AuthApp+h+h+EncounterLoc+p+p+LName+h+FName+h+MName+h+h+h+h+"L"+p+p+DoB+p+Gender+p+h+OName+p+p+PermHamlet+h+PermCouncil+"*"+PermWard+"*"+PermVillage+h+PermDistrict+h+PermRegion+h+h+h+"H~"+ResdHamlet+h+ResdCouncil+"*"+ResdWard+"*"+ResdVillage+h+ResdDistrict+h+ResdRegion+h+h+h+"C~"+BirthHamlet+h+BirthCouncil+"*"+BirthWard+"*"+BirthVillage+h+BirthDistrict+h+BirthRegion+h+h+h+"BR||^PRN^PH^^^^"+MobilePrefix+MobileSuffix+p+p+p+p+p+p+ULNumber+p+DLicense+p+p+p+p+p+p+p+p+NationalID+"\r\n"+
                    PVheader+p+p+'I'+"\r\n"+
                    INheader+p+p+InsuranceID+p+p+InsuranceType+"\r\n"
                ;

                // Send the client to NHCR using events
                var remote = net.createConnection(remoteOptions, () => {
                    let reqdata = VT + message.replace(/ /g,"") + FS + CR
                    console.log(`${new Date()}`);
                    console.log('Connected to HL7 server!');
                    remote.write(new Buffer.from(reqdata, {encoding: "utf8"}));
                });
                remote.on('data', (data) => {
                    var ansData = data.toString();
                    console.log(`HL7 answer data: ${ansData}`);
                    remote.end();
                });
                remote.on('error', (err) => {
                    var reqerror = `Problem with request: ${err.message}`;
                    console.error(reqerror);
                    remote.end();
                    console.log(`Disconnected from HL7 server`);
                });
                remote.on('end', async ()  => {
                    console.log(`Disconnected from HL7 server`);
                    console.log('******Updating client status******');
                    await Client.update({status: 1}, {where: {uuid: client.uuid}})
                });                 
            })
            // @TODO Move this THEN to a relevant location in the document
            .then(client.all())
            // .then(res.redirect('/clients?page='+page))
        })
        console.log('Here');
    },

    confirm(req, res) {
        // import {series} from 'async';
        const async = require('async');
        const {exec} = require('child_process');       
        async.series([
            exec('npx sequelize-cli db:migrate:undo'),
            exec('npx sequelize-cli db:migrate'),
            exec('npx sequelize-cli db:seed:all'),
        ])
        // .then(
        //     async.series([
        //         exec('npx sequelize-cli db:migrate'),
        //     ]))
        // .then(
        //     async.series([
        //         exec('npx sequelize-cli db:seed:all'),
        //     ]))
        .then( res.render('clients/alert'))
        .catch(error => res.status(400).send(error))
    },

    seed(req, res) {
        res.render('clients/confirm');
    },

    redirect(req, res) {
        const page = req.query.page || 2;
        const limit = 10;
        const offset = 10;
        Client.findAndCountAll({
            limit: limit,
            offset: (page - 1) * offset,
            order: [['id', 'ASC']],
            // where: { status: 0 },
        })
        .then(clients => res.render('clients/index  ', {
                "clients": clients.rows,
                "pagesCount": Math.ceil(clients.count/limit),
                "currentPage": page,
            }))
        .catch(error => res.status(400).send(error))
    },
}