import { WordDefinition } from './gradeWords/types';

// Age-appropriate words for 9-12 year olds
export const defaultWords: WordDefinition[] = [
  // 4-letter words
  { word: 'calm', definition: 'Peaceful and quiet, not excited', example: 'The lake was calm without any waves.' },
  { word: 'echo', definition: 'A sound that bounces back to you', example: 'She heard an echo in the canyon.' },
  { word: 'glow', definition: 'To shine softly with light', example: 'The stars glow brightly at night.' },
  { word: 'jump', definition: 'To push off the ground with your feet', example: 'Watch me jump over the puddle.' },
  { word: 'knot', definition: 'A tie made by looping rope or string', example: 'She tied a knot in the rope.' },
  { word: 'maze', definition: 'A puzzle with paths to find your way through', example: 'We got lost in the corn maze.' },
  { word: 'quiz', definition: 'A short test', example: 'We had a spelling quiz today.' },
  { word: 'wrap', definition: 'To cover something by folding material around it', example: 'Please wrap the gift in paper.' },

  // 5-letter words
  { word: 'brave', definition: 'Not afraid to face danger', example: 'The brave knight saved the village.' },
  { word: 'crisp', definition: 'Firm and crunchy, or cool and fresh', example: 'The apple was crisp and delicious.' },
  { word: 'float', definition: 'To stay on top of water or air', example: 'Leaves float on the pond.' },
  { word: 'giant', definition: 'Something very large', example: 'A giant tree grew in the yard.' },
  { word: 'hover', definition: 'To stay in one place in the air', example: 'The hummingbird can hover in place.' },
  { word: 'light', definition: 'Brightness that lets you see things', example: 'Turn on the light so we can see.' },
  { word: 'ocean', definition: 'A very large body of salt water', example: 'Whales live in the ocean.' },
  { word: 'swift', definition: 'Moving very fast', example: 'The swift runner won the race.' },

  // 6-letter words
  { word: 'anchor', definition: 'A heavy object that keeps a ship in place', example: 'The ship dropped its anchor.' },
  { word: 'bridge', definition: 'A structure that crosses over water or a road', example: 'We walked across the bridge.' },
  { word: 'castle', definition: 'A large stone building where royalty lived', example: 'The king lived in a castle.' },
  { word: 'dragon', definition: 'A mythical creature that breathes fire', example: 'The dragon guarded its treasure.' },
  { word: 'escape', definition: 'To get away from danger', example: 'The bird tried to escape the cage.' },
  { word: 'frozen', definition: 'Turned to ice; very cold', example: 'The pond was frozen solid.' },
  { word: 'galaxy', definition: 'A huge group of stars in space', example: 'Our galaxy is called the Milky Way.' },
  { word: 'hollow', definition: 'Empty inside', example: 'The old tree was hollow inside.' },

  // 7-letter words
  { word: 'balance', definition: 'Staying steady without falling', example: 'She kept her balance on the beam.' },
  { word: 'captain', definition: 'The leader of a ship or team', example: 'The captain steered the ship.' },
  { word: 'dolphin', definition: 'A smart sea animal that swims and jumps', example: 'We saw a dolphin leap from the water.' },
  { word: 'explore', definition: 'To travel to discover new places', example: 'They went to explore the cave.' },
  { word: 'glacier', definition: 'A huge mass of slow-moving ice', example: 'The glacier moved slowly down the mountain.' },
  { word: 'harvest', definition: 'Gathering crops when they are ready', example: 'Farmers harvest wheat in autumn.' },
  { word: 'journey', definition: 'A trip from one place to another', example: 'The journey took three hours.' },
  { word: 'mystery', definition: 'Something strange that is hard to explain', example: 'The missing key was a mystery.' },

  // 8-letter words
  { word: 'absolute', definition: 'Complete and total', example: 'The room was in absolute silence.' },
  { word: 'boundary', definition: 'A line that marks the edge of an area', example: 'The fence marks the property boundary.' },
  { word: 'calendar', definition: 'A chart showing days, weeks, and months', example: 'I marked the date on my calendar.' },
  { word: 'daughter', definition: 'A female child', example: 'Their daughter learned to ride a bike.' },
  { word: 'elephant', definition: 'The largest land animal with a trunk', example: 'The elephant sprayed water with its trunk.' },
  { word: 'fraction', definition: 'A part of a whole number', example: 'One half is a simple fraction.' },
  { word: 'grateful', definition: 'Feeling thankful', example: 'I am grateful for your help.' },
  { word: 'hospital', definition: 'A place where sick people get care', example: 'The doctor works at the hospital.' },

  // Challenge words
  { word: 'adventure', definition: 'An exciting journey or experience', example: 'Going camping was a fun adventure.' },
  { word: 'beautiful', definition: 'Very pretty or lovely to look at', example: 'The sunset was beautiful.' },
  { word: 'challenge', definition: 'Something difficult that tests your skill', example: 'The puzzle was a real challenge.' },
  { word: 'dangerous', definition: 'Likely to cause harm', example: 'Swimming alone can be dangerous.' },
  { word: 'excellent', definition: 'Very good; outstanding', example: 'She did an excellent job.' },
  { word: 'fantastic', definition: 'Wonderful and amazing', example: 'The magician gave a fantastic show.' },
  { word: 'geography', definition: 'The study of Earth\'s lands and places', example: 'We study maps in geography class.' },
  { word: 'happiness', definition: 'The feeling of being joyful', example: 'Her smile showed her happiness.' },
  { word: 'important', definition: 'Having great value or meaning', example: 'Water is important for all living things.' },
  { word: 'knowledge', definition: 'Things you learn and understand', example: 'Books give us knowledge.' },
];

// Export just the word strings for backwards compatibility
export const defaultWordStrings: string[] = defaultWords.map(w => w.word);
