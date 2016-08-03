import Vott from 'vott'
import express from 'express'
import bodyParser from 'body-parser'
import request from 'request-promise'

export class MessengerBot extends Vott {
  constructor (config) {
    super(config)
    this.platform = 'Messenger'
    this.config.endpoint = '/facebook/receive'
    this.config.port = 8080
    this.config = Object.assign(this.config, config)
  }

  send (event) {
    const payload = { recipient: { id: event.user.id } }

    if (event.sender_action) {
      payload.sender_action = event.sender_action
    } else {
      payload.message = event.message

      if (event.message && event.message.notification_type) {
        payload.notification_type = event.message.notification_type
      }
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
            uri: 'https://graph.facebook.com/v2.6/me/messages',
            body: message,
            json: true
          }

          request(options).then((res) => {
            this.log('message_sent', `Sent message to ${event.user.id}`, res)
          }).catch((error) => {
            this.log('send_error', 'Message not sent', { error, event })
          })
        })
      } else {
        this.log('send_error', `Token not found ${event.user.page_id}`, event)
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
          this.emit('message_echo', this, event)
        } else {
          this.dispatch('message_received', event)
        }
      } else if (event.postback) {
        event.message = { text: event.postback.payload }
        this.dispatch('postback_received', event)
      } else if (event.optin) {
        this.emit('optin', this, event)
      } else if (event.account_linking) {
        this.emit('account_linking', this, event)
      } else if (event.delivery) {
        this.emit('message_delivered', this, event)
      } else if (event.read) {
        this.emit('message_read', this, event)
      } else {
        this.emit('unhandled_event', this, event)
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
      this.log('webserver_set', `Listening on port ${port}`)
      if (callback) callback(null, this.webserver)
    })

    return this
  }

  /** handles POST webhook */
  _post (req, res) {
    if (req.body && req.body.entry) {
      req.body.entry.forEach((entry) => {
        if (entry.messaging) {
          entry.messaging.forEach((message) => {
            const event = {
              user: {
                id: message.sender.id,
                page_id: message.recipient.id
              }
            }

            delete message.sender
            delete message.recipient

            this.receive(Object.assign(message, event))
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
  setupWebhooks (webserver = this.webserver) {
    if (webserver) {
      webserver.post(this.config.endpoint, this._post.bind(this))
      webserver.get(this.config.endpoint, this._get.bind(this))

      this.log('webhook_set', `Receiving webhooks at ${this.config.endpoint}`)
    } else {
      throw Error('No web server set or passed as argument')
    }

    return this
  }
}

module.exports = MessengerBot
