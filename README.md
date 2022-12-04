![Logo](admin/my-muell.png)
# ioBroker.my-muell

[![NPM version](https://img.shields.io/npm/v/iobroker.my-muell.svg)](https://www.npmjs.com/package/iobroker.my-muell)
[![Downloads](https://img.shields.io/npm/dm/iobroker.my-muell.svg)](https://www.npmjs.com/package/iobroker.my-muell)
![Number of Installations](https://iobroker.live/badges/my-muell-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/my-muell-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.my-muell.png?downloads=true)](https://nodei.co/npm/iobroker.my-muell/)

**Tests:** ![Test and Release](https://github.com/plm2310/ioBroker.my-muell/workflows/Test%20and%20Release/badge.svg)

## my-muell adapter for ioBroker

Calls API https://mymuell.jumomind.com/mmapp/api.php to read MyMüll waste schedule.
The usage is decribed [here](https://www.mariotti.de/abfallkalender-in-home-assistant-einrichten-mit-mymuell-als-datenquelle/). 

The adapter will request and analyze the return waste schedule and creates states for:
- the next waste collection with date and type
- the next waste collection with date for each type of waste
- optional a list of all dates provided

# Information for setup the instance
The configuration is set with Dummy Values for the City and waste collection Area for the API Call, so that no states will be set when intantiating the adapter. Follow the steps described in the instance configuration to determine your correct values and restart the adapter.

The Adapter is scheduled by default to run every 12 hours. As the Adapter is also calculating the remaining days for the next date, it should at leadst run once a day, otherwise it might be possible that the countdown is calculated correctly.


## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 0.1.1 (2022-12-04)
* (Michael Ploch) initial release for testing

## License
MIT License

Copyright (c) 2022 Michael Ploch <miploch@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.