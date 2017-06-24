import test from 'ava'
import MessengerBot from '../src/index'
import nock from 'nock'
import express from 'express'
import bodyParser from 'body-parser'
import request from 'supertest'
import sinon from 'sinon'

test.beforeEach((t) => {
  /** sender_action: plain text */
  nock('https://graph.facebook.com')
    .post('/v2.6/me/messages', {
      recipient: {
        id: '0'
      },
      message: {
        text: 'hi'
      },
      notification_type: 'SILENT_PUSH',
      access_token: 'ABC'
    })
    .reply(200, {
      recipient_id: '0',
      message_id: 'mid.001'
    })

  /** sender_action: typing_on */
  nock('https://graph.facebook.com')
    .post('/v2.6/me/messages', {
      recipient: {
        id: '0'
      },
      sender_action: 'typing_on',
      access_token: 'ABC'
    })
    .reply(200, {
      recipient_id: '0',
      message_id: 'mid.002'
    })

  /** sender_action: typing_off */
  nock('https://graph.facebook.com')
    .post('/v2.6/me/messages', {
      recipient: {
        id: '0'
      },
      sender_action: 'typing_off',
      access_token: 'ABC'
    })
    .reply(200, {
      recipient_id: '0',
      message_id: 'mid.003'
    })

  /** phone_number when !user.id */
  nock('https://graph.facebook.com')
    .post('/v2.6/me/messages', {
      recipient: {
        phone_number: '+1(212)555-2368'
      },
      message: {
        text: 'hi'
      },
      access_token: 'ABC'
    })
    .reply(200, {
      recipient_id: '0',
      message_id: 'mid.004'
    })
})

test('[VottMessenger#constructor] properly constructs class', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC',
    verify_token: 'FB',
    endpoint: '/receive',
    port: 5000
  })

  t.is(bot.config.access_token, 'ABC')
  t.is(bot.config.verify_token, 'FB')
  t.is(bot.config.endpoint, '/receive')
  t.is(bot.config.port, 5000)
})

test('[VottMessenger#constructor] maintains default configuration when no config given', (t) => {
  const bot = new MessengerBot()

  t.is(bot.config.tick_interval, 1000)
  t.is(bot.config.max_thread_age, 1800000)
  t.is(bot.config.endpoint, '/facebook/receive')
  t.is(bot.config.port, 8080)
})

test('[VottMessenger#constructor] properly constructs with defaults', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC',
    verify_token: 'FB'
  })

  t.is(bot.config.access_token, 'ABC')
  t.is(bot.config.verify_token, 'FB')
  t.is(bot.config.endpoint, '/facebook/receive')
  t.is(bot.config.port, 8080)
})

test('[VottMessenger#send] sends a text message', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('message_sent', (event) => { resolve(event) })

    bot.send({
      user: {
        id: '0',
        page_id: 'my_page'
      },
      message: {
        text: 'hi',
        notification_type: 'SILENT_PUSH'
      }
    })
  }).then((v) => {
    t.deepEqual(v.response, {
      recipient_id: '0',
      message_id: 'mid.001'
    })
  })
})

test('[VottMessenger#send] sends a sender_action: typing on', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('message_sent', (event) => {
      resolve(event)
    })
    bot.typingOn({ user: { id: '0' } })
  }).then((v) => {
    t.deepEqual(v.response, {
      recipient_id: '0',
      message_id: 'mid.002'
    })
  })
})

test('[VottMessenger#send] sends a sender_action: typing off', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('message_sent', (event) => {
      resolve(event)
    })
    bot.typingOff({ user: { id: '0' } })
  }).then((v) => {
    t.deepEqual(v.response, {
      recipient_id: '0',
      message_id: 'mid.003'
    })
  })
})

test('[VottMessenger#send] uses phone number when !user.id', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  const message = {
    user: {
      phone_number: '+1(212)555-2368',
      page_id: 'my_page'
    },
    message: {
      text: 'hi'
    }
  }

  return new Promise((resolve, reject) => {
    bot.on('message_sent', (event) => {
      resolve(event)
    })

    bot.send(message)
  }).then((v) => {
    t.deepEqual(v.response, {
      recipient_id: '0',
      message_id: 'mid.004'
    })
  })
})

test('[VottMessenger#send] properly emits `error` event when send fails', (t) => {
  const bot = new MessengerBot({
    access_token: 'DEF' // wrong token on purpose
  })

  const message = {
    user: {
      phone_number: '+1(212)555-2368',
      page_id: 'my_page'
    },
    message: {
      text: 'hi'
    }
  }

  return new Promise((resolve, reject) => {
    bot.on('error', (error) => {
      resolve(error)
    })

    bot.send(message)
  }).then((error) => {
    t.truthy(error)
  })
})

test('[VottMessenger#send] logs error when token not found', (t) => {
  const bot = new MessengerBot({}) // no tokens ;)
  const message = {
    user: {
      id: 'songo',
      page_id: 'my_page'
    },
    message: {
      text: 'hi'
    }
  }

  return new Promise((resolve, reject) => {
    bot.on('error', (error) => {
      resolve(error)
    })

    bot.send(message)
  }).then((v) => {
    t.is(v.message, 'Token not found.')
  })
})

test('[VottMessenger#receive] dispatches message_received', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  bot.use('message_received', (bot, event, next) => {
    event.custom_field = 'a'
    next()
  })

  return new Promise((resolve, reject) => {
    bot.on('message_received', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      message: {
        text: 'hi'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      custom_field: 'a',
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      message: {
        text: 'hi'
      },
      chat_enabled: true,
      event_type: 'message_received'
    })
  })
})

test('[VottMessenger#receive] dispatches postback_received', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  bot.use('postback_received', (bot, event, next) => {
    event.custom_field = 'a'
    next()
  })

  return new Promise((resolve, reject) => {
    bot.on('postback_received', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      postback: {
        payload: 'hi'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      custom_field: 'a',
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      message: {
        text: 'hi'
      },
      postback: {
        payload: 'hi'
      },
      chat_enabled: true,
      event_type: 'postback_received'
    })
  })
})

test('[VottMessenger#receive] emits optin', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('optin', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      optin: {
        ref: 'PASS_THRU'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      optin: {
        ref: 'PASS_THRU'
      },
      event_type: 'optin'
    })
  })
})

test('[VottMessenger#receive] emits payment', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('payment', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      chat_enabled: true,
      payment: {
        prop_a: 'A',
        prop_b: 'B'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      chat_enabled: true,
      message: {
        prop_a: 'A',
        prop_b: 'B'
      },
      payment: {
        prop_a: 'A',
        prop_b: 'B'
      },
      event_type: 'payment'
    })
  })
})

test('[VottMessenger#receive] emits referral', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('referral', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      referral: {
        prop_a: 'A',
        prop_b: 'B'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      referral: {
        prop_a: 'A',
        prop_b: 'B'
      },
      event_type: 'referral'
    })
  })
})

test('[VottMessenger#receive] emits checkout_update', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('checkout_update', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      chat_enabled: true,
      checkout_update: {
        prop_a: 'A',
        prop_b: 'B'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      chat_enabled: true,
      message: {
        prop_a: 'A',
        prop_b: 'B'
      },
      checkout_update: {
        prop_a: 'A',
        prop_b: 'B'
      },
      event_type: 'checkout_update'
    })
  })
})

test('[VottMessenger#receive] emits account_linking', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('account_linking', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      account_linking: {
        status: 'linked',
        authorization_code: 'ABC'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      account_linking: {
        status: 'linked',
        authorization_code: 'ABC'
      },
      event_type: 'account_linking'
    })
  })
})

test('[VottMessenger#receive] emits message_delivered', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('message_delivered', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      delivery: {
        a: 'a'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      delivery: {
        a: 'a'
      },
      event_type: 'message_delivered'
    })
  })
})

test('[VottMessenger#receive] emits message_read', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('message_read', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      read: {
        a: 'a'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      read: {
        a: 'a'
      },
      event_type: 'message_read'
    })
  })
})

test('[VottMessenger#receive] emits message_echo', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('message_echo', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      message: {
        is_echo: true,
        text: 'hi'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      message: {
        is_echo: true,
        text: 'hi'
      },
      event_type: 'message_echo'
    })
  })
})

test('[VottMessenger#receive] emits unhandled_event', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.on('unhandled_event', (bot, event) => {
      resolve(event)
    })

    bot.receive({
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      ununactium: {
        a: 'a'
      }
    })
  }).then((value) => {
    t.deepEqual(value, {
      user: {
        id: 'songo',
        page_id: 'my_page'
      },
      ununactium: {
        a: 'a'
      },
      event_type: 'unhandled_event'
    })
  })
})

test('[VottMessenger#getAccessToken] gets access token (singular)', (t) => {
  const bot = new MessengerBot({
    access_token: 'ABC'
  })

  return new Promise((resolve, reject) => {
    bot.getAccessToken('0', (token) => {
      resolve(token)
    })
  }).then((token) => {
    t.is(token, 'ABC')
  })
})

test('[VottMessenger#getAccessToken] gets access token (plural)', (t) => {
  const bot = new MessengerBot({
    access_token: {
      'my_page': 'ABC',
      'my_other_page': 'DEF'
    }
  })

  return new Promise((resolve, reject) => {
    bot.getAccessToken('my_page', (token) => {
      resolve(token)
    })
  }).then((token) => {
    t.is(token, 'ABC')
  })
})

test('[VottMessenger#getAccessToken] returns false when not found', (t) => {
  const bot = new MessengerBot({
    access_token: {
      'my_page': 'ABC',
      'my_other_page': 'DEF'
    }
  })

  return new Promise((resolve, reject) => {
    bot.getAccessToken('random', (token) => {
      resolve(token)
    })
  }).then((token) => {
    t.false(token)
  })
})

test('[VottMessenger#setupServer] sets up an express server', (t) => {
  const bot = new MessengerBot()

  bot.setupServer()
  t.truthy(bot.webserver)
  t.truthy(bot.webserver.use)
  t.truthy(bot.webserver.get)
  t.truthy(bot.webserver.post)
})

test('[VottMessenger#setupServer] server listens', (t) => {
  const bot = new MessengerBot()

  return new Promise((resolve, reject) => {
    bot.setupServer(8081, (err, server) => {
      resolve({ err, server })
    })
  }).then((obj) => {
    t.is(obj.err, null)
    t.truthy(obj.server)
    t.truthy(obj.server.use)
    t.truthy(obj.server.get)
    t.truthy(obj.server.post)
  })
})

test('[VottMessenger#_get] handles GET endpoint', (t) => {
  const bot = new MessengerBot({
    verify_token: 'FB'
  })

  const mockRequest = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'FB',
      'hub.challenge': 'challenge'
    }
  }
  return new Promise((resolve, reject) => {
    const mockResponse = {
      send: (arg) => {
        resolve(arg)
      },
      sendStatus: (arg) => {
        resolve(arg)
      }
    }

    bot._get(mockRequest, mockResponse)
  }).then((arg) => {
    t.is(arg, 'challenge')
  })
})

test('[VottMessenger#_get] 401 when verify_token invalid', (t) => {
  const bot = new MessengerBot({
    verify_token: 'FB'
  })

  const mockRequest = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'FBI',
      'hub.challenge': 'challenge'
    }
  }
  return new Promise((resolve, reject) => {
    const mockResponse = {
      send: (arg) => {
        resolve(arg)
      },
      sendStatus: (arg) => {
        resolve(arg)
      }
    }

    bot._get(mockRequest, mockResponse)
  }).then((arg) => {
    t.is(arg, 401)
  })
})

test('[VottMessenger#_post] properly receives message requests', (t) => {
  const bot = new MessengerBot()

  const mockRequest = {
    body: {
      entry: [
        {
          messaging: [
            {
              sender: { id: '0' },
              recipient: { id: 'my_page' },
              message: {
                text: 'one'
              }
            },
            {
              sender: { id: '1' },
              recipient: { id: 'my_page' },
              message: {
                text: 'two'
              }
            }
          ]
        },
        {
          messaging: [
            {
              sender: { id: '2' },
              recipient: { id: 'my_other_page' },
              message: {
                text: 'three'
              }
            }
          ]
        },
        {
          other_stuff: 'blah'
        }
      ]
    }
  }

  return new Promise((resolve, reject) => {
    const mockResponse = {
      send: (arg) => {},
      sendStatus: (arg) => {}
    }

    const messages = []

    bot.use('inbound', (bot, event, next) => {
      messages.push(event)

      if (messages.length === 3) {
        resolve(messages)
      }
    })

    bot._post(mockRequest, mockResponse)
  }).then((messages) => {
    t.deepEqual(messages, [
      {
        message: { text: 'one' },
        user: { id: '0', page_id: 'my_page' }
      },
      {
        message: { text: 'two' },
        user: { id: '1', page_id: 'my_page' }
      },
      {
        message: { text: 'three' },
        user: { id: '2', page_id: 'my_other_page' }
      }
    ])
  })
})

test('[VottMessenger#_post] 400 when missing fields', (t) => {
  const bot = new MessengerBot()

  const mockRequest = {
    body: {}
  }

  return new Promise((resolve, reject) => {
    const mockResponse = {
      send: (arg) => {
        resolve(arg)
      },
      sendStatus: (arg) => {
        resolve(arg)
      }
    }

    bot._post(mockRequest, mockResponse)
  }).then((arg) => {
    t.is(arg, 400)
  })
})

test('[VottMessenger#setupWebhooks] adds POST and GET endpoint to app/router', (t) => {
  const bot = new MessengerBot()
  const router = {
    get: sinon.spy(),
    post: sinon.spy()
  }

  const endpoint = '/'

  const x = bot.setupWebhooks(router, endpoint)

  t.true(router.get.calledOnce)
  t.true(router.post.calledOnce)
  t.true(x === bot)
})

test('[VottMessenger#setupWebhooks] throws when no arguments are passed', (t) => {
  const bot = new MessengerBot()

  t.throws(() => {
    bot.setupWebhooks()
  })
})

// Builds a basic express app with JSON parser
const expressAppFactory = () => {
  const app = express()

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  return app
}

// Builds an express app with a MessengerBot as middleware
const botAsExpressMiddleware = () => {
  const app = expressAppFactory()

  const bot = new MessengerBot({
    access_token: 'ABC',
    verify_token: 'FB',
    port: 5000
  })

  app.use('/facebook/receive', bot.useAsMiddleware())

  return app
}

test('[VottMessenger#useAsMiddleware] serves as middleware to express app', async (t) => {
  const res = await request(botAsExpressMiddleware())
    .get('/facebook/receive?hub.mode=subscribe&hub.verify_token=FB&hub.challenge=blah')
    .set('Content-Type', 'application/json')
    .send()

  t.is(res.status, 200)
  t.is(res.text, 'blah')
})
