/**
 * Grade 4 Spelling Words (Ages 9-10)
 *
 * Focus areas:
 * - Longer words with complex patterns
 * - Silent letters (kn, wr, gh)
 * - Homophones
 * - Prefixes (un-, re-, dis-, pre-)
 * - Suffixes (-ful, -less, -ment, -ness)
 * - Irregular plurals
 */

import { WordDefinition } from './types';

export const grade4Words: WordDefinition[] = [
  // Silent letter patterns
  { word: 'knight', definition: 'A soldier in armor from long ago', example: 'The brave knight saved the kingdom from the dragon.' },
  { word: 'knuckle', definition: 'The bony joint in your finger', example: 'I bumped my knuckle on the edge of the table.' },
  { word: 'knowledge', definition: 'Things you know and understand', example: 'Reading books helps you gain knowledge.' },
  { word: 'knife', definition: 'A tool with a sharp blade for cutting', example: 'Use a knife to cut the vegetables for dinner.' },
  { word: 'knee', definition: 'The joint in the middle of your leg', example: 'I scraped my knee when I fell off my bike.' },
  { word: 'wrong', definition: 'Not correct or right', example: 'I got the wrong answer on the math problem.' },
  { word: 'write', definition: 'To put words on paper', example: 'Please write your name at the top of the page.' },
  { word: 'wrinkle', definition: 'A small fold or crease in something', example: 'There was a wrinkle in my shirt that I needed to iron.' },
  { word: 'wrestle', definition: 'To fight by grabbing and pushing', example: 'The two puppies like to wrestle on the carpet.' },
  { word: 'wrist', definition: 'The joint between your hand and arm', example: 'She wears a bracelet on her wrist.' },
  { word: 'ghost', definition: 'The spirit of a dead person', example: 'The ghost in the story haunted the old house.' },
  { word: 'ghastly', definition: 'Very scary or terrible', example: 'The monster mask looked ghastly in the dark.' },
  { word: 'though', definition: 'Even if; however', example: 'I went outside though it was raining.' },
  { word: 'through', definition: 'From one side to the other', example: 'The ball rolled through the tunnel.' },
  { word: 'thorough', definition: 'Complete and careful', example: 'She did a thorough job cleaning her room.' },
  { word: 'island', definition: 'Land surrounded by water', example: 'We took a boat to visit the small island.' },
  { word: 'listen', definition: 'To pay attention to sounds', example: 'Please listen carefully to the instructions.' },
  { word: 'whistle', definition: 'To make a high sound by blowing', example: 'The coach blew her whistle to start the game.' },
  { word: 'castle', definition: 'A large stone building where kings lived', example: 'The princess lived in a beautiful castle.' },
  { word: 'hustle', definition: 'To move quickly and with energy', example: 'We had to hustle to catch the bus on time.' },
  { word: 'climb', definition: 'To go up using hands and feet', example: 'I like to climb the rope in gym class.' },
  { word: 'thumb', definition: 'The short thick finger on your hand', example: 'I accidentally hit my thumb with the hammer.' },
  { word: 'lamb', definition: 'A baby sheep', example: 'The fluffy lamb followed its mother around the field.' },
  { word: 'comb', definition: 'A tool with teeth for fixing hair', example: 'I use a comb to fix my hair each morning.' },
  { word: 'bomb', definition: 'A weapon that explodes', example: 'The movie showed a bomb being safely removed.' },

  // Homophones (commonly confused)
  { word: 'their', definition: 'Belonging to them', example: 'The students put their books in their backpacks.' },
  { word: 'there', definition: 'In that place', example: 'Put the vase over there on the table.' },
  { word: 'wear', definition: 'To have clothes on your body', example: 'What should I wear to the party tonight?' },
  { word: 'where', definition: 'In what place', example: 'Where did you find those beautiful flowers?' },
  { word: 'weather', definition: 'What it\'s like outside - sunny, rainy, etc.', example: 'The weather forecast says it will be sunny tomorrow.' },
  { word: 'whether', definition: 'If one thing or another', example: 'I wonder whether we should bring an umbrella.' },
  { word: 'which', definition: 'What one of several choices', example: 'Which movie would you like to watch tonight?' },
  { word: 'witch', definition: 'A woman with magic powers in stories', example: 'The witch in the fairy tale cast a spell.' },
  { word: 'peace', definition: 'Quiet and calm, no fighting', example: 'After the argument, they made peace with each other.' },
  { word: 'piece', definition: 'A part of something', example: 'May I have a piece of that delicious cake?' },
  { word: 'principal', definition: 'The head of a school', example: 'The principal gave a speech at the assembly.' },
  { word: 'principle', definition: 'A rule or belief you follow', example: 'Honesty is an important principle to live by.' },
  { word: 'stationary', definition: 'Not moving, staying in one place', example: 'The exercise bike is stationary but feels like riding.' },
  { word: 'stationery', definition: 'Paper and supplies for writing', example: 'I bought new stationery to write letters.' },
  { word: 'accept', definition: 'To take something offered to you', example: 'She was happy to accept the award.' },
  { word: 'except', definition: 'Not including; but not', example: 'Everyone came to the party except my cousin.' },
  { word: 'affect', definition: 'To change or influence something', example: 'Bad weather can affect your mood.' },
  { word: 'effect', definition: 'The result of something', example: 'The medicine had a positive effect on her health.' },
  { word: 'advice', definition: 'Help or suggestions given to someone', example: 'My grandmother always gives good advice.' },

  // Prefix un-
  { word: 'unable', definition: 'Not able to do something', example: 'I was unable to finish my homework last night.' },
  { word: 'uncertain', definition: 'Not sure about something', example: 'I am uncertain about which path to take.' },
  { word: 'unclear', definition: 'Hard to understand', example: 'The instructions were unclear so I asked for help.' },
  { word: 'uncommon', definition: 'Not usual; rare', example: 'It is uncommon to see snow in April here.' },
  { word: 'unfair', definition: 'Not treating everyone equally', example: 'The referee made an unfair decision.' },
  { word: 'unhappy', definition: 'Not happy; sad', example: 'The child was unhappy when the toy broke.' },
  { word: 'unlikely', definition: 'Probably won\'t happen', example: 'It is unlikely that it will snow in summer.' },
  { word: 'unlock', definition: 'To open a lock', example: 'Please unlock the door so I can come in.' },
  { word: 'unpack', definition: 'To take things out of a bag or box', example: 'I need to unpack my suitcase after the trip.' },
  { word: 'unsafe', definition: 'Not safe; dangerous', example: 'The broken bridge was unsafe to cross.' },

  // Prefix re-
  { word: 'rebuild', definition: 'To build again', example: 'They had to rebuild the house after the storm.' },
  { word: 'recall', definition: 'To remember something', example: 'I cannot recall where I put my keys.' },
  { word: 'recycle', definition: 'To use materials again', example: 'We recycle paper and plastic at our school.' },
  { word: 'refresh', definition: 'To make fresh again', example: 'A cold drink will refresh you on a hot day.' },
  { word: 'remind', definition: 'To help someone remember', example: 'Please remind me to call my grandmother.' },
  { word: 'remove', definition: 'To take away', example: 'Please remove your shoes before coming inside.' },
  { word: 'repeat', definition: 'To do or say again', example: 'Could you please repeat the question?' },
  { word: 'replace', definition: 'To put something new in its place', example: 'We need to replace the broken window.' },
  { word: 'report', definition: 'To tell about something that happened', example: 'The news will report on the weather tonight.' },
  { word: 'return', definition: 'To come or go back', example: 'I will return the library book tomorrow.' },

  // Prefix dis-
  { word: 'disagree', definition: 'To have a different opinion', example: 'My brother and I disagree about which movie to watch.' },
  { word: 'disappear', definition: 'To go away and not be seen', example: 'The magician made the rabbit disappear.' },
  { word: 'disappoint', definition: 'To make someone feel let down', example: 'I did not want to disappoint my parents.' },
  { word: 'discover', definition: 'To find something new', example: 'Scientists discover new species every year.' },
  { word: 'discuss', definition: 'To talk about something', example: 'Let us discuss the plans for the party.' },
  { word: 'disease', definition: 'An illness or sickness', example: 'Washing your hands helps prevent disease.' },
  { word: 'dishonest', definition: 'Not telling the truth', example: 'It is wrong to be dishonest about your mistakes.' },
  { word: 'dislike', definition: 'To not like something', example: 'I dislike the taste of bitter vegetables.' },
  { word: 'disobey', definition: 'To not follow rules or orders', example: 'The puppy would often disobey its owner.' },
  { word: 'disrupt', definition: 'To stop something from continuing', example: 'Please do not disrupt the class during the test.' },

  // Prefix pre-
  { word: 'predict', definition: 'To say what will happen before it does', example: 'Weather forecasters predict the rain tomorrow.' },
  { word: 'prefer', definition: 'To like one thing more than another', example: 'I prefer chocolate ice cream over vanilla.' },
  { word: 'prepare', definition: 'To get ready for something', example: 'We need to prepare dinner for our guests.' },
  { word: 'present', definition: 'A gift or the current time', example: 'I wrapped the birthday present in colorful paper.' },
  { word: 'pretend', definition: 'To act like something is real when it\'s not', example: 'The children pretend to be superheroes.' },
  { word: 'prevent', definition: 'To stop something from happening', example: 'Wearing a helmet can prevent head injuries.' },
  { word: 'preview', definition: 'To see something before others do', example: 'We saw a preview of the new movie.' },
  { word: 'previous', definition: 'Coming before in time', example: 'The previous owner painted the house blue.' },
  { word: 'preheat', definition: 'To heat up before using', example: 'Preheat the oven before baking the cookies.' },
  { word: 'prefix', definition: 'Letters added to the start of a word', example: 'The prefix un means not in the word unhappy.' },

  // Suffix -ful
  { word: 'beautiful', definition: 'Very pretty or lovely', example: 'The sunset was beautiful with orange and pink colors.' },
  { word: 'careful', definition: 'Being cautious to avoid mistakes', example: 'Be careful when you cross the street.' },
  { word: 'cheerful', definition: 'Happy and positive', example: 'Her cheerful smile made everyone feel welcome.' },
  { word: 'colorful', definition: 'Having many bright colors', example: 'The parrot had colorful feathers.' },
  { word: 'fearful', definition: 'Feeling scared', example: 'The cat was fearful of the loud thunder.' },
  { word: 'grateful', definition: 'Feeling thankful', example: 'I am grateful for my loving family.' },
  { word: 'harmful', definition: 'Causing damage or hurt', example: 'Too much sun can be harmful to your skin.' },
  { word: 'helpful', definition: 'Making things easier for others', example: 'My neighbor was helpful when I moved in.' },
  { word: 'hopeful', definition: 'Expecting good things to happen', example: 'I am hopeful that we will win the game.' },
  { word: 'peaceful', definition: 'Calm and quiet', example: 'The lake was peaceful early in the morning.' },
  { word: 'playful', definition: 'Full of fun and energy', example: 'The playful puppy chased its tail.' },
  { word: 'powerful', definition: 'Having great strength or control', example: 'The powerful wind knocked down the tree.' },
  { word: 'successful', definition: 'Achieving what you wanted', example: 'The bake sale was very successful.' },
  { word: 'thankful', definition: 'Feeling grateful', example: 'I am thankful for all my friends.' },
  { word: 'wonderful', definition: 'Really great or amazing', example: 'We had a wonderful time at the beach.' },

  // Suffix -less
  { word: 'careless', definition: 'Not being careful', example: 'The careless mistake cost us the game.' },
  { word: 'endless', definition: 'Going on forever', example: 'The desert seemed endless with sand everywhere.' },
  { word: 'fearless', definition: 'Not afraid of anything', example: 'The fearless explorer entered the dark cave.' },
  { word: 'harmless', definition: 'Not dangerous or hurtful', example: 'The spider looks scary but is harmless.' },
  { word: 'helpless', definition: 'Unable to help yourself', example: 'The baby bird looked helpless without its mother.' },
  { word: 'homeless', definition: 'Without a place to live', example: 'The shelter helps homeless people find housing.' },
  { word: 'hopeless', definition: 'Having no hope', example: 'The situation seemed hopeless until help arrived.' },
  { word: 'pointless', definition: 'Having no purpose', example: 'It is pointless to argue about something so small.' },
  { word: 'restless', definition: 'Unable to stay still', example: 'The restless child could not sit quietly.' },
  { word: 'useless', definition: 'Not helpful or needed', example: 'A broken pencil is useless for writing.' },

  // Suffix -ment
  { word: 'amazement', definition: 'Great surprise and wonder', example: 'We watched in amazement as the fireworks lit up the sky.' },
  { word: 'announcement', definition: 'A public statement or news', example: 'The principal made an announcement over the speaker.' },
  { word: 'apartment', definition: 'A home inside a larger building', example: 'They live in an apartment on the fifth floor.' },
  { word: 'argument', definition: 'A disagreement with someone', example: 'The brothers had an argument about the game.' },
  { word: 'development', definition: 'Growth or progress over time', example: 'The development of the new park took two years.' },
  { word: 'environment', definition: 'The world around us; nature', example: 'We should protect the environment by recycling.' },
  { word: 'equipment', definition: 'Tools and supplies needed for a task', example: 'The team brought all their sports equipment.' },
  { word: 'excitement', definition: 'A feeling of being very happy and eager', example: 'The children could barely contain their excitement.' },
  { word: 'government', definition: 'The group that runs a country', example: 'The government makes laws to keep people safe.' },
  { word: 'improvement', definition: 'Getting better at something', example: 'Your grades show great improvement this semester.' },

  // Suffix -ness
  { word: 'awareness', definition: 'Knowing about something', example: 'The campaign raised awareness about recycling.' },
  { word: 'brightness', definition: 'How much light something gives off', example: 'The brightness of the sun hurt my eyes.' },
  { word: 'darkness', definition: 'The absence of light', example: 'The darkness made it hard to see the path.' },
  { word: 'fairness', definition: 'Treating everyone equally', example: 'The teacher showed fairness to all students.' },
  { word: 'firmness', definition: 'Being solid or determined', example: 'The mattress had just the right firmness.' },
  { word: 'happiness', definition: 'The feeling of being happy', example: 'Her face showed pure happiness on her birthday.' },
  { word: 'illness', definition: 'Being sick', example: 'He missed school because of his illness.' },
  { word: 'kindness', definition: 'Being nice to others', example: 'Her kindness made everyone feel welcome.' },
  { word: 'sadness', definition: 'The feeling of being unhappy', example: 'There was sadness in his eyes when he said goodbye.' },
  { word: 'weakness', definition: 'Not being strong', example: 'The illness caused weakness in his muscles.' },

  // Irregular plurals
  { word: 'children', definition: 'More than one child', example: 'The children played together at the park.' },
  { word: 'women', definition: 'More than one woman', example: 'The women formed a book club together.' },
  { word: 'teeth', definition: 'More than one tooth', example: 'Brush your teeth twice a day for good health.' },
  { word: 'feet', definition: 'More than one foot', example: 'My feet were tired after walking all day.' },
  { word: 'geese', definition: 'More than one goose', example: 'A flock of geese flew overhead in a V shape.' },
  { word: 'mice', definition: 'More than one mouse', example: 'The mice hid in the walls of the old barn.' },
  { word: 'leaves', definition: 'More than one leaf', example: 'The leaves turned orange and red in autumn.' },
  { word: 'wolves', definition: 'More than one wolf', example: 'The wolves howled at the full moon.' },
  { word: 'knives', definition: 'More than one knife', example: 'We need sharp knives to cut the bread.' },
  { word: 'shelves', definition: 'More than one shelf', example: 'The library has many shelves full of books.' },

  // Academic words
  { word: 'author', definition: 'A person who writes books', example: 'The author signed copies of her new book.' },
  { word: 'chapter', definition: 'A section of a book', example: 'I finished reading chapter five last night.' },
  { word: 'character', definition: 'A person in a story', example: 'My favorite character in the book is the wizard.' },
  { word: 'climax', definition: 'The most exciting part of a story', example: 'The climax of the movie was very suspenseful.' },
  { word: 'conflict', definition: 'A problem or fight in a story', example: 'Every good story has some kind of conflict.' },
  { word: 'describe', definition: 'To tell about something in words', example: 'Please describe what happened at the party.' },
  { word: 'diagram', definition: 'A drawing that explains something', example: 'The diagram showed how the machine works.' },
  { word: 'divide', definition: 'To split into parts', example: 'We will divide the pizza into eight slices.' },
  { word: 'example', definition: 'Something that shows what you mean', example: 'Can you give me an example of a verb?' },
  { word: 'explain', definition: 'To make something clear', example: 'The teacher will explain the math problem.' },
  { word: 'fraction', definition: 'A part of a whole number', example: 'One half is a simple fraction.' },
  { word: 'paragraph', definition: 'A group of sentences about one idea', example: 'Each paragraph should have a main idea.' },
  { word: 'pattern', definition: 'A design that repeats', example: 'The wallpaper had a flower pattern.' },
  { word: 'problem', definition: 'Something that needs to be solved', example: 'I solved the math problem on my own.' },
  { word: 'sentence', definition: 'A group of words that tells a complete idea', example: 'A sentence always ends with punctuation.' },
  { word: 'solution', definition: 'The answer to a problem', example: 'We found a solution to the puzzle.' },
  { word: 'summary', definition: 'A short version of a longer text', example: 'Write a summary of the story you read.' },
  { word: 'support', definition: 'To help hold something up', example: 'The pillars support the roof of the building.' },
  { word: 'theory', definition: 'An idea that explains something', example: 'Scientists tested the theory with experiments.' },
  { word: 'volume', definition: 'How much space something takes up or how loud', example: 'Please turn down the volume on the television.' },
];

// Export just the word strings for backwards compatibility
export const grade4WordStrings: string[] = grade4Words.map(w => w.word);

export default grade4Words;
