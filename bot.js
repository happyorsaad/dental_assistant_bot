// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.qnaMaker = new QnAMaker(configuration.QnAConfiguration);
       
        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);

        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.qnaMaker.getAnswers(context);
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);
                     
            // determine which service to respond with based on the results from LUIS //
            if (LuisResult.luisResult.prediction.topIntent === "GetAvailability" &&
                LuisResult.intents.GetAvailability.score > .5
            ) {
                const availableSlots = await this.dentistScheduler.getAvailability();
                await context.sendActivity(availableSlots);
                await next();
                return;
            } 
            else if (LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                     LuisResult.intents.ScheduleAppointment.score > .5 &&
                     LuisResult.entities.$instance && 
                     LuisResult.entities.$instance.slot && 
                     LuisResult.entities.$instance.slot[0]
            ){
                const timeSlot = LuisResult.entities.$instance.slot[0].text;
                const schedulerResponse = this.dentistScheduler.scheduleAppointment(timeSlot);
                await context.sendActivity(schedulerResponse);
                await next();
                return;
            }

            if (qnaResults[0]) {
                await context.sendActivity(`${qnaResults[0].answer}`);
            }
            else {
                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity(`I'm not sure I can answer your question`
                    + 'I can find available slots for the dental checkup'
                    + `Or you can ask me to make a reservation for a given time slot\n`);
            }

            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = `Hi, this is your assistant from Contoso.\n`
                        +   `I can help you find available slots\n`
                        +   `Or you can ask me to make a reservation for a given time slot`;
                        
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
