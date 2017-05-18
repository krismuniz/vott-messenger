# [![Vott for Messenger](https://cdn.rawgit.com/krismuniz/vott-messenger/master/header.svg)](https://www.npmjs.com/vott-messenger)

[![npm](https://img.shields.io/npm/v/vott-messenger.svg?style=flat-square)](https://www.npmjs.com/vott-messenger) [![License:MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](http://opensource.org/licenses/MIT) [![Build Status](https://img.shields.io/travis/krismuniz/vott-messenger/master.svg?style=flat-square)](http://travis-ci.org/krismuniz/vott-messenger) [![Coverage Status](https://img.shields.io/coveralls/krismuniz/vott-messenger/master.svg?style=flat-square)](https://coveralls.io/github/krismuniz/vott-messenger?branch=master) [![Dependency Status](https://img.shields.io/david/krismuniz/vott-messenger.svg?style=flat-square)](https://david-dm.org/krismuniz/vott-messenger) [![Known Vulnerabilities](https://snyk.io/test/github/krismuniz/vott-messenger/badge.svg?style=flat-square)](https://snyk.io/test/github/krismuniz/vott-messenger)

**Vott for Messenger** (i.e. `vott-messenger`) is a minimal, extensible framework for building Messenger bots.

## Features

* Fully extensible conversational flow (middleware and plugins)
* Serves multiple pages from a single instance
* Scoped questions for complex conversational trees
* [Thoroughly](https://coveralls.io/github/krismuniz/vott-messenger) [tested](http://travis-ci.org/krismuniz/vott-messenger) and [secure](https://snyk.io/test/github/krismuniz/vott-messenger)


#### Simplicity First

In order to keep `vott` as simple as possible, `vott` makes no assumption on state-management, persistence layers, or message-processing functionality. Extra functionality must be provided by developers and third-party plugins or middleware.

## Installation

```bash
$ npm install --save vott-messenger
```

## Quick Example

```js
const MessengerBot = require('vott-messenger')

/** instantiate MessengerBot */
const myBot = new MessengerBot({
  access_token: process.env.FB_PAGE_ACCESS_TOKEN,
  verify_token: process.env.FB_VERIFY_TOKEN,
  endpoint: '/facebook/receive'
})

/** usage example: */
myBot.on('message_received', (bot, event) => {
  bot.chat(event, (chat) => {
    chat.say('Hello!')
    chat.ask('How are you?', (res, chat) => {
      chat.save({ user_status: res.text })
      chat.say('Ok')
      chat.next()
    })
    chat.next()
  })
})

myBot.setupServer(process.env.PORT, (err, server) => {
  if (err) throw Error(err)
  console.log(`Server listening on port ${process.env.PORT}`)
}).setupWebhooks()
```

## Documentation

### Guides
* [Installing Vott for Messenger](https://github.com/krismuniz/vott-messenger/wiki/Installing)
* Getting Started
* Serving Multiple Pages
* Adding Persistence Layers
* Adding Middleware
* Adding Plugins

### Reference

* [API Reference](https://github.com/krismuniz/vott-messenger/wiki/Reference)

## Contributing
[![Dev Dependency Status](https://img.shields.io/david/dev/krismuniz/vott-messenger.svg?style=flat-square)](https://david-dm.org/krismuniz/vott-messenger) [![Code-Style:Standard](https://img.shields.io/badge/code%20style-standard-yellow.svg?style=flat-square)](http://standardjs.com/)

#### Bug Reports & Feature Requests

Something does not work as expected or perhaps you think this module needs a feature? Please open an issue using GitHub's issue tracker. Please be as specific and straightforward as possible.

#### Developing

Pull Requests (PRs) are welcome. Make sure you follow the [same basic stylistic conventions](http://standardjs.com/rules.html) as the original code. Your changes must be concise and focus on solving a single problem.

#### Build Instructions for Contributors

Clone the repo:

```bash
$ git clone git@github.com:krismuniz/vott-messenger.git
```

Install all dependencies and run tests:
```bash
$ npm install && npm test
```

## License

[The MIT License (MIT)](https://github.com/krismuniz/vott-messenger/blob/master/LICENSE.md)

Copyright (c) 2017 [Kristian Muñiz](https://www.krismuniz.com)
