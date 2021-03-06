/* eslint standard/no-callback-literal: 0 */

import Vott from 'vott'
import express from 'express'
import bodyParser from 'body-parser'
import request from 'request-promise-native'

export class MessengerBot extends Vott {
  constructor (config) {
    super(config)
    this.platform = 'Messenger'
    this.config.endpoint = '/facebook/receive'
    this.config.port = 8080
    this.config = Object.assign(this.config, config)
  }

  send (event) {
    const payload = {
      recipient: { id: event.user.id }
    }

    if (event.messaging_type) {
      payload.messaging_type = event.messaging_type
    } else {
      payload.messaging_type = !event.tag ? 'RESPONSE' : 'MESSAGE_TAG'
    }

    if (event.tag) {
      payload.tag = event.tag
    }

    if (event.sender_action) {
      payload.sender_action = event.sender_action
    } else {
      payload.message = event.message
    }

    if (event.notification_type) {
      payload.notification_type = event.notification_type
    }

    if (!event.user.id && event.user.phone_number) {
      payload.recipient.phone_number = event.user.phone_number
    }

    this.getAccessToken(event.user.page_id, (token) => {
      if (token) {
        payload.access_token = token

        this.outbound(payload, (bot, message) => {
          const options = {
            method: 'POST',
            uri: this.config.api_url || 'https://graph.facebook.com/v2.6/me/messages',
            body: message,
            json: true
          }

          request(options).then((response) => {
            this.emit('message_sent', { response, message })
          }).catch((error) => {
            this.emit('error', error)
          })
        })
      } else {
        this.emit('error', { message: 'Token not found.' })
      }
    })
  }

  /** sends typing_on sender action */
  typingOn (event) {
    this.send({
      user: event.user,
      sender_action: 'typing_on'
    })
  }

  /** sends typing_off sender action */
  typingOff (event) {
    this.send({
      user: event.user,
      sender_action: 'typing_off'
    })
  }

  /** routes received messages */
  receive (event) {
    this.inbound(event, (bot, event) => {
      if (event.message) {
        if (event.message.is_echo) {
          this.dispatch('message_echo', event)
        } else {
          event.chat_enabled = true
          this.dispatch('message_received', event)
        }
      } else if (event.delivery) {
        this.dispatch('message_delivered', event)
      } else if (event.read) {
        this.dispatch('message_read', event)
      } else if (event.postback) {
        event.message = { text: event.postback.payload }
        event.chat_enabled = true

        this.dispatch('postback_received', event)
      } else if (event.optin) {
        this.dispatch('optin', event)
      } else if (event.referral) {
        this.dispatch('referral', event)
      } else if (event.payment) {
        event.chat_enabled = true
        event.message = event.payment

        this.dispatch('payment', event)
      } else if (event.pre_checkout) {
        this.dispatch('pre_checkout', event)
      } else if (event.checkout_update) {
        event.chat_enabled = true
        event.message = event.checkout_update

        this.dispatch('checkout_update', event)
      } else if (event.account_linking) {
        this.dispatch('account_linking', event)
      } else {
        this.dispatch('unhandled_event', event)
      }
    })
  }

  /** gets access token for a given page_id */
  getAccessToken (id, callback) {
    if (this.config.access_token) {
      if (typeof this.config.access_token === 'string') {
        callback(this.config.access_token)
      } else if (this.config.access_token[id]) {
        callback(this.config.access_token[id])
      } else {
        callback(false)
      }
    } else {
      callback(false)
    }
  }

  /** sets up an express server */
  setupServer (port = this.config.port, callback) {
    this.webserver = express()
    this.webserver.set('x-powered-by', false)
    this.webserver.use(bodyParser.json())
    this.webserver.use(bodyParser.urlencoded({ extended: true }))

    this.webserver.listen(port, () => {
      this.emit('webserver_listening', this.webserver)

      if (callback) callback(null, this.webserver)
    })

    return this
  }

  /** handles POST webhook */
  _post (req, res) {
    if (req.body && req.body.entry) {
      req.body.entry.forEach((entry) => {
        if (entry.messaging) {
          entry.messaging.forEach((e) => {
            const isEcho = e.message && e.message.is_echo === true
            const event = {
              user: {
                id: isEcho ? e.recipient.id : e.sender.id,
                page_id: isEcho ? e.sender.id : e.recipient.id
              }
            }

            for (let key in e) {
              if (key !== 'sender' && key !== 'recipient') {
                event[key] = e[key]
              }
            }

            this.receive(event)
          })
        }
      })

      res.send('OK')
    } else {
      res.sendStatus(400)
    }
  }

  /** handles GET endpoint for verification */
  _get (req, res) {
    const isSubscribeMode = req.query['hub.mode'] === 'subscribe'
    const sameToken = req.query['hub.verify_token'] === this.config.verify_token

    if (isSubscribeMode && sameToken) {
      res.send(req.query['hub.challenge'])
    } else {
      res.sendStatus(401)
    }
  }

  /** sets up webhooks */
  setupWebhooks (webserver = this.webserver, endpoint = this.config.endpoint) {
    webserver.post(endpoint, this._post.bind(this))
    webserver.get(endpoint, this._get.bind(this))
    return this
  }

  useAsMiddleware () {
    const router = express.Router()

    this.setupWebhooks(router, '/')
    return router
  }
}

module.exports = MessengerBot
