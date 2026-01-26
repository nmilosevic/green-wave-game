# Green Wave

A puzzle-driving game about timing, patience, and catching the perfect rhythm of city traffic lights.

**Play the game:** [https://nmilosevic.github.io/green-wave-game/](https://nmilosevic.github.io/green-wave-game/)

## The Story Behind the Game

When I was a kid, my dad would drive me into the city. There was one particular street we'd always pass through, and every time, he'd tell me about the "green wave" - how traffic engineers had carefully synchronized the lights so that if you drove at just the right speed, you'd glide through intersection after intersection without ever stopping. The lights would turn green one after another, like magic, as if the city itself was letting you through.

That memory stuck with me. The idea that somewhere between too fast and too slow, there's a perfect speed - a rhythm you can find if you pay attention. This game is my attempt to capture that feeling: the satisfaction of reading the road ahead, adjusting your pace, and flowing through the city in one unbroken wave of green.

## How to Play

**Controls:**
- **W** or **↑** - Gas pedal (accelerate)
- **S** or **↓** - Brake pedal (decelerate)
- **R** - Restart current level
- Release both keys to coast (gradual slowdown from friction)

**Objective:**
Pass through all traffic lights while they're green (or yellow) and reach the finish line.

**Traffic Light Cycle:**
The game uses a European-style traffic light sequence:
- **Red** - Stop (running this fails the level)
- **Yellow** - Caution, about to turn green (you can pass)
- **Green** - Go!
- **Blinking Yellow** - Warning, about to turn red (you can still pass)

**Scoring:**
- **Time** - Your completion time is tracked, with best times saved per level
- **Stars** - Earn up to 3 stars based on driving smoothness (fewer speed changes = more stars)

**Fail Conditions:**
- Running a red light
- Coming to a complete stop

**Tips:**
- Watch the timer bars on traffic lights - they show how long until the light changes
- Yellow before green gives you a heads-up to prepare
- Blinking yellow means hurry or slow down for the next cycle
- Smooth, consistent speed earns more stars than constant adjustments
- Each level has a rhythm to discover - it's a puzzle, not a race

## Running the Game

Simply open `index.html` in any modern web browser. No build step or server required.

## Project Structure

```
green-wave-game/
├── index.html    # Game page with styling
├── game.js       # Game logic and rendering
├── README.md     # This file
└── IDEAS.md      # Future features and improvements
```

## Technical Details

- Built with vanilla HTML5 Canvas and JavaScript
- No external dependencies
- Runs entirely client-side
- Compatible with all modern browsers
- Best times persisted in localStorage
- Accessible with ARIA labels for screen readers

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- **Game design & development** - Original concept and implementation
- **Mobile adaptations** - Responsive design, touch controls, landscape optimization, and UI refinement with assistance from Claude Haiku
