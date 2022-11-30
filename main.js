'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const { isNumberObject } = require('util/types');

// Load your modules here, e.g.:
// const fs = require("fs");

class MyMuell extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'my-muell',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.debug('config City: ' + this.config.cityId);
		this.log.debug('config AreaID: ' + this.config.areaId);

		if (isNaN(this.config.areaId)){
			this.log.error ('no AreaID specified, check Adapter configuration');
		}

		if (isNaN(this.config.cityId)){
			this.log.error ('no cityID specified, check Adapter configuration');
		}

		try {
			/*Read MyMuellData with unofficial API decribed here:
			https://www.mariotti.de/abfallkalender-in-home-assistant-einrichten-mit-mymuell-als-datenquelle/
			*/
			const url = `https://mymuell.jumomind.com/mmapp/api.php?r=dates&city_id=${this.config.cityId}&area_id=${this.config.areaId}`;
			this.log.debug('API-Call:' + url);
			const res = await axios.get(url);
			this.processMyMuellData(res.data);


		} catch (error) {
			// Handle errors
			this.log.error(`Error in API-Call: ${error}`);
		}

		//Stop Adapter after all things are domne so that it can restart with the next schedule
		this.terminate ? this.terminate('All Data processed, stop adapter for next schedule') : process.exit(0);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

	/**
	 * @param {object[]} data
	 */
	async processMyMuellData(data){
		this.log.debug ('processData: ' + JSON.stringify(data));
		this.setState('rawDataJson', { val: 'test', ack: true });

		await this.setStateAsync('rawDataJson', { val: JSON.stringify(data), ack: true });

		let nextElement;
		let nextByType = new Array();
		//Loop all Trash Items from MyMuell
		data.forEach((/** @type {any} */ element) => {
			this.log.debug(`process line ${JSON.stringify(element)}`);

			// next Element with lowest Date
			if (nextElement == null || nextElement.day > element.day){
				nextElement = element;
			}

			// check next element for each Type
			//Build List per Type for Next Date
			if (nextByType.hasOwnProperty(element.trash_name)==true){
				//Mülltonne schon bekannt, frühestes Datum prüfen
				if(nextByType[element.trash_name].day > element.day){
					nextByType[element.trash_name] = element;
				}
			}else{
				//neuer Typ als ersten Eintrag hinzufügen
				nextByType[element.trash_name] = element;
			}


		});

		//Set next trash to be collected
		if (nextElement != null){

			this.log.debug (`next Collection: ${JSON.stringify(nextElement)}`);
			// Set States for next Date:
			await this.setStateAsync('next.name', { val: nextElement.title , ack: true });
			await this.setStateAsync('next.color', { val: nextElement.color , ack: true });
			await this.setStateAsync('next.date', { val: nextElement.day , ack: true });
			await this.setStateAsync('next.desc', { val: nextElement.description , ack: true });
			await this.setStateAsync('next.type', { val: nextElement.trash_name , ack: true });
		}

		//Set Trash by Type
		nextByType.forEach(async (/** @type {any} */ element) => {
			this.log.debug(`nextByType ${JSON.stringify(element)}`);
			let objectid = 'waste.' + element.trash_name;

			await this.setObjectNotExistsAsync(objectid, {
				type: 'device',
				common: {
					name: element.title,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(objectid + '.color', {
				type: 'state',
				common: {
					name: 'Color',
					type: 'string',
					role: 'level.color.rgb',
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(objectid + '.name', {
				type: 'state',
				common: {
					name: 'Name',
					type: 'string',
					role: 'string',
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(objectid + '.next_date', {
				type: 'state',
				common: {
					name: 'Name',
					type: 'string',
					role: 'date',
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(objectid + '.next_desc', {
				type: 'state',
				common: {
					name: 'Name',
					type: 'string',
					role: 'text',
					read: true,
					write: false,
				},
				native: {},
			});

		});

	}

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new MyMuell(options);
} else {
	// otherwise start the instance directly
	new MyMuell();
}