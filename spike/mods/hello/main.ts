import { command } from 'modlock'

// Greet each player who types /hello in chat.
command('hello', (player) => {
  player.chat('Hello from Hello!')
})
