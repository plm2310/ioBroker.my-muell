'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;

const nodeTypeTrash = 'TRASH';
const nodeTypeDate = 'DATE';
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
		this.log.debug(`config All Dates: ${this.config.saveAllDates} with max ${this.config.maxNumberOfDates} days`);

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
			const res = await axios.get(url, { headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' }, params: { trophies: true } });

			if (res.status == 200){
				//if status is ok, than process data
				this.log.info (`API Call return: ${res.statusText} statuscode: ${res.status}`);
				await this.processMyMuellData(res.data);
			} else {
				this.log.error (`Error on API Call. Return: ${res.statusText} statuscode: ${res.status}`);
			}

			//delete Old Date Channels whcih are in the past
			this.deleteOldDateChannels();

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

		let /** @type {any} */ nextElement;
		const nextByType = new Map();
		const allByDate = new Map();

		///////////////////////////////////////////////////////////////
		// 1. Loop all Trash Items from MyMuell Api Call and determine
		//    - next Item to be collected
		//	  - next Day for each Type of wast
		//	  - sorted list by Date
		////////////////////////////////////////////////////////////////
		data.forEach((/** @type {any} */ element) => {
			this.log.debug(`process line ${JSON.stringify(element)}`);

			// next Element with lowest Date
			if (nextElement == null || nextElement.day > element.day){
				nextElement = element;
			}

			// check next element for each Type
			//Build List per Type for Next Date
			if (nextByType.has(element.trash_name)==true){
				//Mülltonne schon bekannt, frühestes Datum prüfen
				if(nextByType.get(element.trash_name).day > element.day){
					nextByType.set(element.trash_name, element);
				}
			}else{
				//neuer Typ als ersten Eintrag hinzufügen
				nextByType.set(element.trash_name, element);
			}

			if (this.config.saveAllDates){
				if (allByDate.size < this.config.maxNumberOfDates){
					allByDate.set(formatDateKey(element.day), element);
				}
			}
		});

		///////////////////////////////////////////////////////////////
		// 2. Set States for the next waste to be collected
		////////////////////////////////////////////////////////////////
		if (nextElement != null){

			this.log.debug (`Update States for next Collection: ${JSON.stringify(nextElement)}`);
			// Set States for next Date:
			await this.setStateAsync('next.name', { val: nextElement.title , ack: true });
			await this.setStateAsync('next.color', { val: nextElement.color , ack: true });
			await this.setStateAsync('next.date', { val: nextElement.day , ack: true });
			await this.setStateAsync('next.desc', { val: nextElement.description , ack: true });
			await this.setStateAsync('next.type', { val: nextElement.trash_name , ack: true });
			const diff = this.getTimeDiff(new Date(nextElement.day));
			await this.setStateAsync('next.countdown', { val: (await diff).valueOf() , ack: true });

		}

		///////////////////////////////////////////////////////////////
		// 3. Create States and Set States for the next waste for each
		//    Type of Trash.
		////////////////////////////////////////////////////////////////
		this.log.debug (`Start create / Update states for each waste type`);

		let objectid = '';
		//Set loop over collection with each type and create states and update values
		for (const key of nextByType.keys()) {
			const trashItem = nextByType.get(key);
			this.log.debug (`waste type ${key}: ${JSON.stringify(trashItem)}`);

			//create states for each type
			objectid = 'waste.' + key;
			await this.createAndSetStates(objectid, trashItem, nodeTypeTrash);
		}
		///////////////////////////////////////////////////////////////
		// 4. Sort List by Date and Create Folder for each date and
		//    create and Set the states for the waste Collection
		////////////////////////////////////////////////////////////////
		if (this.config.saveAllDates){
			this.log.debug (`Create Objects and set States for all dates`);
			objectid = '';

			//Set loop over collection with each type and create states and update values
			for (const key of allByDate.keys()) {
				const trashItem = allByDate.get(key);
				this.log.debug (`Date ${key}: ${JSON.stringify(trashItem)}`);

				//create states for each date
				objectid = 'allDates.' + key;
				await this.createAndSetStates(objectid, trashItem, nodeTypeDate);
			}
		}
	}

	async deleteOldDateChannels (){
		const dateChannels = await this.getChannelsOfAsync('allDates');
		const now = new Date();
		const todayString = formatDateKey (now);

		let delCounter = 0;

		this.log.debug ('Check Channels in the Past in AllDates to be deleted')
		for (let i = 0; i < dateChannels.length; i++){
			const channelString = dateChannels[i]._id.substring(dateChannels[i]._id.lastIndexOf('.')+1);
			if (channelString < todayString){
				this.log.debug (`Delete Channel: ${dateChannels[i]._id}`);
				this.delObjectAsync (dateChannels[i]._id);
				delCounter = delCounter + 1;
			}
		}
		if (delCounter > 0){
			this.log.info (`Deleted ${delCounter} outdated Channels in Folder AllDates`);
		}
	}

	async createAndSetStates (objectid, trashItem, nodeType){
		if (nodeType == nodeTypeTrash){
			//Create device Folder by Type
			await this.setObjectNotExistsAsync(objectid, {
				type: 'device',
				common: {
					name: trashItem.title,
				},
				native: {},
			});
		}

		if(nodeType == nodeTypeDate){
			//Create channel for each date
			await this.setObjectNotExistsAsync(objectid, {
				type: 'channel',
				common: {
					name: trashItem.title,
				},
				native: {},
			});

			//add Type to each date:
			//create and set color
			await this.setObjectNotExistsAsync(`${objectid}.type`, {
				type: 'state',
				common: {
					name: {
						en: 'Type',
						de: 'Art',
						ru: 'Тип',
						pt: 'Tipo',
						nl: 'Type',
						fr: 'Type',
						it: 'Tipo',
						es: 'Tipo',
						pl: 'Typ',
						uk: 'Тип',
						'zh-cn': '类型'
					},
					type: 'string',
					role: 'text',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setStateAsync(`${objectid}.type`, { val: trashItem.trash_name , ack: true });
		}

		//create and set color
		await this.setObjectNotExistsAsync(`${objectid}.color`, {
			type: 'state',
			common: {
				name: {
					en: 'Color',
					de: 'Farbe',
					ru: 'Цвет',
					pt: 'Cor',
					nl: 'Color',
					fr: 'Couleur',
					it: 'Colore',
					es: 'Color',
					pl: 'Color',
					uk: 'Колір',
					'zh-cn': '科 法 律'
				},
				type: 'string',
				role: 'level.color.rgb',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setStateAsync(`${objectid}.color`, { val: trashItem.color , ack: true });

		//create and set name
		await this.setObjectNotExistsAsync(`${objectid}.name`, {
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
		await this.setStateAsync(`${objectid}.name`, { val: trashItem.title , ack: true });

		//create and set next date
		await this.setObjectNotExistsAsync(`${objectid}.next_date`, {
			type: 'state',
			common: {
				name: {
					en: 'Date',
					de: 'Datum',
					ru: 'Дата',
					pt: 'Data',
					nl: 'Datum',
					fr: 'Date',
					it: 'Data',
					es: 'Fecha',
					pl: 'D',
					uk: 'Дата',
					'zh-cn': '日期'
				},
				type: 'string',
				role: 'date',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setStateAsync(`${objectid}.next_date`, { val: trashItem.day , ack: true });

		if (nodeType == nodeTypeTrash){
			//create and set next countdown
			await this.setObjectNotExistsAsync(`${objectid}.countdown`, {
				type: 'state',
				common: {
					name: {
						en: 'Countdown',
						de: 'Countdown',
						ru: 'Отсчет',
						pt: 'Contagem',
						nl: 'Aftellen',
						fr: 'Compte à rebours',
						it: 'Conteggio',
						es: 'Cuenta atrás',
						pl: 'Countdown',
						uk: 'Відправити',
						'zh-cn': '倒数'
					},
					desc: {
						en: 'Countdown in days',
						de: 'Countdown in Tagen',
						ru: 'Отсчет в дни',
						pt: 'Contagem regressiva em dias',
						nl: 'Aftellen in dagen',
						fr: 'Compte à rebours en jours',
						it: 'Conto alla rovescia nei giorni',
						es: 'Cuenta atrás en días',
						pl: 'Countdown w dni',
						uk: 'Відлік в день',
						'zh-cn': 'A. 日内降'
					},
					type: 'number',
					role: 'value.interval',
					unit: 'd',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setStateAsync(`${objectid}.countdown`, { val: (await this.getTimeDiff(new Date(trashItem.day))).valueOf() , ack: true });
		}

		//create and set description
		await this.setObjectNotExistsAsync(`${objectid}.next_desc`, {
			type: 'state',
			common: {
				name: {
					en: 'description',
					de: 'Beschreibung',
					ru: 'описание',
					pt: 'descrição',
					nl: 'beschrijving',
					fr: 'description',
					it: 'descrizione',
					es: 'descripción',
					pl: 'opis',
					uk: 'опис',
					'zh-cn': '说明'
				},
				type: 'string',
				role: 'text',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setStateAsync(`${objectid}.next_desc`, { val: trashItem.description , ack: true });
	}
	/**
	 * Calculated time difference in Full days from now to the given date
	 * @param {Date} date
	 */
	async getTimeDiff(date){
		const now = new Date();
		//reset time of day to get fullday difference
		now.setHours (0,0,0,0);
		date.setHours(0,0,0,0);

		const Difference_In_Time = date.getTime() - now.getTime();
		return Math.round(Difference_In_Time / (1000 * 3600 * 24));
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
/**
* Format Day to YYYYMMDD to be used as device name for all Dates folder
* @param {object} trashDay
* @returns {string} string
*/
function formatDateKey(trashDay){
	const date = new Date(trashDay);
	const month = ('0' + (date.getMonth() + 1)).slice(-2);
	const day = ('0' + date.getDate()).slice(-2);
	return date.getFullYear() + month + day;
}