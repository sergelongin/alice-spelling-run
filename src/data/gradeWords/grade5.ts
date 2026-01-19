/**
 * Grade 5 Spelling Words (Ages 10-11)
 *
 * Focus areas:
 * - Greek and Latin roots
 * - Advanced prefixes (anti-, inter-, trans-, sub-)
 * - Advanced suffixes (-tion, -sion, -ous, -ible, -able)
 * - Double consonant rules
 * - Academic vocabulary
 * - Commonly misspelled words
 */

import { WordDefinition } from './types';

export const grade5Words: WordDefinition[] = [
  // Greek roots (graph, photo, tele, bio)
  { word: 'autograph', definition: 'A person\'s signature written by hand', example: 'I got the famous author\'s autograph on my book.' },
  { word: 'biography', definition: 'A book about someone\'s life', example: 'I read a biography about Abraham Lincoln.' },
  { word: 'geography', definition: 'The study of Earth\'s lands and places', example: 'In geography class we learned about mountains.' },
  { word: 'paragraph', definition: 'A group of sentences about one idea', example: 'Write a paragraph about your favorite animal.' },
  { word: 'photograph', definition: 'A picture taken with a camera', example: 'We took a family photograph at the beach.' },
  { word: 'telephone', definition: 'A device for talking to people far away', example: 'She answered the telephone on the second ring.' },
  { word: 'television', definition: 'A device that shows moving pictures and sound', example: 'We watched a documentary on television last night.' },
  { word: 'telescope', definition: 'A tool for seeing things far away in space', example: 'Through the telescope we could see the moon\'s craters.' },
  { word: 'telegram', definition: 'A message sent over wires using code', example: 'Before phones people sent urgent news by telegram.' },
  { word: 'biology', definition: 'The study of living things', example: 'In biology we dissected a frog.' },

  // Latin roots (dict, port, tract, struct)
  { word: 'dictionary', definition: 'A book that explains what words mean', example: 'I looked up the word in the dictionary.' },
  { word: 'predict', definition: 'To say what will happen before it does', example: 'Scientists predict the weather using data.' },
  { word: 'verdict', definition: 'The decision made in a court case', example: 'The jury announced their verdict after deliberating.' },
  { word: 'contradict', definition: 'To say the opposite of what someone said', example: 'The evidence seemed to contradict his story.' },
  { word: 'dictator', definition: 'A ruler with total power over a country', example: 'The dictator ruled the country for twenty years.' },
  { word: 'transport', definition: 'To move people or things from place to place', example: 'Trucks transport goods across the country.' },
  { word: 'portable', definition: 'Easy to carry around', example: 'I brought a portable speaker to the picnic.' },
  { word: 'import', definition: 'To bring goods into a country', example: 'The store decided to import tea from India.' },
  { word: 'export', definition: 'To send goods to another country', example: 'Brazil exports coffee to countries around the world.' },
  { word: 'support', definition: 'To help hold something up or encourage someone', example: 'The beams support the weight of the roof.' },
  { word: 'attract', definition: 'To pull something toward you', example: 'Magnets attract metal objects.' },
  { word: 'subtract', definition: 'To take away from a number', example: 'Subtract five from ten to get five.' },
  { word: 'contract', definition: 'A written agreement or to get smaller', example: 'Both teams signed the contract before the game.' },
  { word: 'distract', definition: 'To take someone\'s attention away', example: 'Please don\'t distract me while I study.' },
  { word: 'extract', definition: 'To pull or take something out', example: 'The dentist had to extract my tooth.' },
  { word: 'construct', definition: 'To build something', example: 'Workers construct new homes in our neighborhood.' },
  { word: 'destruct', definition: 'To destroy or break apart', example: 'The old building will self-destruct in the demolition.' },
  { word: 'instruct', definition: 'To teach or give directions', example: 'The coach will instruct the players on the new drill.' },
  { word: 'structure', definition: 'How something is built or organized', example: 'The bridge has a sturdy steel structure.' },
  { word: 'obstruct', definition: 'To block or get in the way', example: 'The fallen tree will obstruct the road.' },

  // Prefix anti-
  { word: 'antibiotic', definition: 'Medicine that kills germs', example: 'The doctor prescribed an antibiotic for my infection.' },
  { word: 'anticipate', definition: 'To expect something to happen', example: 'We anticipate a large crowd at the concert.' },
  { word: 'antique', definition: 'Something old and valuable', example: 'My grandmother has an antique clock from 1890.' },
  { word: 'antiseptic', definition: 'A substance that kills germs on skin', example: 'The nurse applied antiseptic to my cut.' },
  { word: 'antifreeze', definition: 'Liquid that keeps engines from freezing', example: 'Dad added antifreeze to the car before winter.' },

  // Prefix inter-
  { word: 'interact', definition: 'To communicate or work with others', example: 'Students interact with each other during group projects.' },
  { word: 'interfere', definition: 'To get in the way of something', example: 'Please do not interfere with my work.' },
  { word: 'international', definition: 'Between different countries', example: 'The airline offers international flights to Europe.' },
  { word: 'interrupt', definition: 'To stop someone while they\'re speaking', example: 'It is rude to interrupt when others are talking.' },
  { word: 'interview', definition: 'A meeting where someone asks you questions', example: 'She had an interview for the job today.' },

  // Prefix trans-
  { word: 'transfer', definition: 'To move from one place to another', example: 'I had to transfer to a different bus.' },
  { word: 'transform', definition: 'To change into something different', example: 'The caterpillar will transform into a butterfly.' },
  { word: 'translate', definition: 'To change words into another language', example: 'Can you translate this sentence into Spanish?' },
  { word: 'transmit', definition: 'To send a signal or message', example: 'Radio towers transmit signals for miles.' },
  { word: 'transparent', definition: 'Clear enough to see through', example: 'The glass window is transparent.' },

  // Prefix sub-
  { word: 'submarine', definition: 'A ship that travels underwater', example: 'The submarine dove deep into the ocean.' },
  { word: 'submit', definition: 'To give something to someone in charge', example: 'Please submit your homework by Friday.' },
  { word: 'subtract', definition: 'To take away from a number', example: 'When you subtract three from seven you get four.' },
  { word: 'suburban', definition: 'An area near a city where people live', example: 'We moved to a suburban neighborhood outside the city.' },
  { word: 'subway', definition: 'A train that runs underground', example: 'I take the subway to get to school downtown.' },

  // Suffix -tion
  { word: 'abbreviation', definition: 'A shortened form of a word', example: 'Dr. is the abbreviation for doctor.' },
  { word: 'celebration', definition: 'A party or event for a special occasion', example: 'We had a celebration for my sister\'s graduation.' },
  { word: 'civilization', definition: 'A society with culture and government', example: 'Ancient Egyptian civilization built the pyramids.' },
  { word: 'combination', definition: 'Two or more things together', example: 'The combination of peanut butter and jelly is delicious.' },
  { word: 'communication', definition: 'Sharing information with others', example: 'Good communication is important in teamwork.' },
  { word: 'concentration', definition: 'Focusing your mind on one thing', example: 'The test requires a lot of concentration.' },
  { word: 'conversation', definition: 'A talk between two or more people', example: 'We had an interesting conversation about space.' },
  { word: 'education', definition: 'Learning in school or from experience', example: 'Education helps you prepare for the future.' },
  { word: 'explanation', definition: 'Making something clear to understand', example: 'The teacher gave a clear explanation of the problem.' },
  { word: 'imagination', definition: 'The ability to picture things in your mind', example: 'Use your imagination to write a creative story.' },
  { word: 'information', definition: 'Facts and knowledge about something', example: 'The library has information on many topics.' },
  { word: 'operation', definition: 'A process or medical procedure', example: 'The doctor performed the operation successfully.' },
  { word: 'organization', definition: 'A group with a purpose or keeping things neat', example: 'The charity organization helps homeless pets.' },
  { word: 'population', definition: 'The number of people in a place', example: 'The city\'s population has grown to one million.' },
  { word: 'preparation', definition: 'Getting ready for something', example: 'Preparation for the test took several hours.' },

  // Suffix -sion
  { word: 'collision', definition: 'When two things crash into each other', example: 'The collision between the cars damaged both vehicles.' },
  { word: 'conclusion', definition: 'The ending or final decision', example: 'The story had a surprising conclusion.' },
  { word: 'confusion', definition: 'Not understanding something clearly', example: 'There was confusion about the homework assignment.' },
  { word: 'decision', definition: 'A choice you make', example: 'Making the right decision can be difficult.' },
  { word: 'discussion', definition: 'A talk about a topic', example: 'We had a discussion about the book in class.' },
  { word: 'division', definition: 'Splitting into parts or a math operation', example: 'Division is the opposite of multiplication.' },
  { word: 'explosion', definition: 'A sudden loud burst', example: 'The explosion of fireworks lit up the sky.' },
  { word: 'expression', definition: 'A look on your face or a phrase', example: 'Her expression showed that she was surprised.' },
  { word: 'impression', definition: 'An idea or feeling about something', example: 'The new student made a good impression on everyone.' },
  { word: 'permission', definition: 'Being allowed to do something', example: 'I asked for permission to leave class early.' },
  { word: 'possession', definition: 'Something you own', example: 'My favorite possession is my grandfather\'s watch.' },
  { word: 'profession', definition: 'A job that needs special training', example: 'Teaching is a rewarding profession.' },
  { word: 'television', definition: 'A device that shows moving pictures and sound', example: 'We watched the news on television this morning.' },
  { word: 'tension', definition: 'Stress or tightness', example: 'There was tension in the room before the announcement.' },
  { word: 'version', definition: 'One form of something', example: 'I prefer the original version of that song.' },

  // Suffix -ous
  { word: 'ambitious', definition: 'Wanting to achieve great things', example: 'The ambitious student wants to become a doctor.' },
  { word: 'anxious', definition: 'Worried or nervous', example: 'She felt anxious before the big exam.' },
  { word: 'cautious', definition: 'Being very careful', example: 'Be cautious when crossing a busy street.' },
  { word: 'conscious', definition: 'Awake and aware', example: 'The patient was conscious after the surgery.' },
  { word: 'courageous', definition: 'Very brave', example: 'The courageous soldier saved his friends.' },
  { word: 'curious', definition: 'Wanting to know or learn', example: 'The curious child asked many questions.' },
  { word: 'dangerous', definition: 'Likely to cause harm', example: 'Swimming alone can be dangerous.' },
  { word: 'delicious', definition: 'Tasting very good', example: 'The pizza smelled delicious.' },
  { word: 'enormous', definition: 'Extremely large', example: 'An enormous elephant stood near the watering hole.' },
  { word: 'famous', definition: 'Known by many people', example: 'The famous singer performed at the stadium.' },
  { word: 'furious', definition: 'Extremely angry', example: 'Dad was furious when I broke the window.' },
  { word: 'generous', definition: 'Willing to give and share', example: 'My generous aunt always gives great gifts.' },
  { word: 'gorgeous', definition: 'Very beautiful', example: 'The sunset over the ocean was gorgeous.' },
  { word: 'jealous', definition: 'Wanting what someone else has', example: 'He felt jealous of his brother\'s new bike.' },
  { word: 'mysterious', definition: 'Strange and hard to explain', example: 'The mysterious footprints led into the forest.' },
  { word: 'nervous', definition: 'Worried or uneasy', example: 'I was nervous before my first day at school.' },
  { word: 'obvious', definition: 'Easy to see or understand', example: 'The answer to the riddle was obvious.' },
  { word: 'previous', definition: 'Coming before in time', example: 'We discussed the previous chapter yesterday.' },
  { word: 'ridiculous', definition: 'Very silly or absurd', example: 'The clown wore a ridiculous outfit.' },
  { word: 'serious', definition: 'Not joking; important', example: 'This is a serious matter we need to discuss.' },

  // Suffix -ible/-able
  { word: 'available', definition: 'Ready to use or able to be gotten', example: 'The book is available at the library.' },
  { word: 'comfortable', definition: 'Feeling relaxed and at ease', example: 'This chair is very comfortable to sit in.' },
  { word: 'considerable', definition: 'Large enough to matter', example: 'We spent a considerable amount of time on the project.' },
  { word: 'favorable', definition: 'Showing support or approval', example: 'The critics gave the movie favorable reviews.' },
  { word: 'horrible', definition: 'Very bad or scary', example: 'The storm was horrible with strong winds.' },
  { word: 'impossible', definition: 'Not able to happen or be done', example: 'It seemed impossible to finish in time.' },
  { word: 'incredible', definition: 'Hard to believe; amazing', example: 'The magician performed an incredible trick.' },
  { word: 'invisible', definition: 'Not able to be seen', example: 'The superhero became invisible to hide from villains.' },
  { word: 'possible', definition: 'Able to happen or be done', example: 'With hard work anything is possible.' },
  { word: 'probable', definition: 'Likely to happen', example: 'It is probable that we will have rain tomorrow.' },
  { word: 'reasonable', definition: 'Fair and sensible', example: 'The store offered a reasonable price for the jacket.' },
  { word: 'remarkable', definition: 'Worth noticing; special', example: 'She made remarkable progress in just one month.' },
  { word: 'responsible', definition: 'In charge of something; reliable', example: 'Being responsible means doing your chores.' },
  { word: 'terrible', definition: 'Very bad', example: 'The movie had terrible reviews from critics.' },
  { word: 'visible', definition: 'Able to be seen', example: 'The mountains were visible from our window.' },

  // Double consonant challenges
  { word: 'accommodate', definition: 'To make room for or help someone', example: 'The hotel can accommodate up to 200 guests.' },
  { word: 'accomplish', definition: 'To finish something successfully', example: 'I was able to accomplish all my goals this year.' },
  { word: 'according', definition: 'As said by someone', example: 'According to the weather report it will snow tonight.' },
  { word: 'accurate', definition: 'Exactly correct', example: 'Make sure your answers are accurate.' },
  { word: 'accuse', definition: 'To blame someone for doing wrong', example: 'Do not accuse someone without evidence.' },
  { word: 'beginning', definition: 'The start of something', example: 'The beginning of the book was very exciting.' },
  { word: 'committed', definition: 'Dedicated to doing something', example: 'She is committed to practicing piano every day.' },
  { word: 'committee', definition: 'A group that makes decisions together', example: 'The committee met to plan the school fair.' },
  { word: 'different', definition: 'Not the same', example: 'My sister and I have different hobbies.' },
  { word: 'difficult', definition: 'Hard to do', example: 'The math test was very difficult.' },
  { word: 'disappear', definition: 'To go away and not be seen', example: 'The sun seemed to disappear behind the clouds.' },
  { word: 'disappoint', definition: 'To make someone feel let down', example: 'I did not want to disappoint my coach.' },
  { word: 'embarrass', definition: 'To make someone feel awkward', example: 'I did not mean to embarrass you in front of your friends.' },
  { word: 'excellent', definition: 'Very good; outstanding', example: 'You did an excellent job on your science project.' },
  { word: 'exaggerate', definition: 'To make something seem bigger than it is', example: 'He tends to exaggerate how long his walk was.' },
  { word: 'immediate', definition: 'Happening right now', example: 'The problem requires immediate attention.' },
  { word: 'necessary', definition: 'Needed; must have', example: 'It is necessary to study for the exam.' },
  { word: 'occasion', definition: 'A special event or time', example: 'Her birthday is a special occasion to celebrate.' },
  { word: 'occurred', definition: 'Happened', example: 'The accident occurred at the intersection.' },
  { word: 'recommend', definition: 'To suggest something is good', example: 'I recommend this restaurant for dinner.' },

  // Commonly misspelled words
  { word: 'address', definition: 'Where someone lives or works', example: 'Please write your address on the envelope.' },
  { word: 'although', definition: 'Even though', example: 'Although it rained we still had fun at the park.' },
  { word: 'ancient', definition: 'From a very long time ago', example: 'Ancient Rome had many great buildings.' },
  { word: 'appearance', definition: 'How someone or something looks', example: 'The actor changed his appearance for the role.' },
  { word: 'calendar', definition: 'A chart showing days and months', example: 'I marked the date on my calendar.' },
  { word: 'cemetery', definition: 'A place where dead people are buried', example: 'We visited the cemetery to honor our relatives.' },
  { word: 'conscience', definition: 'The feeling of right and wrong inside you', example: 'My conscience told me to tell the truth.' },
  { word: 'definitely', definition: 'For sure; without doubt', example: 'I will definitely be at your party.' },
  { word: 'desperate', definition: 'Willing to try anything; very needy', example: 'The lost hikers were desperate for water.' },
  { word: 'discipline', definition: 'Training to follow rules or a subject area', example: 'Self-discipline helps you reach your goals.' },
  { word: 'especially', definition: 'More than others; particularly', example: 'I love fruits especially strawberries.' },
  { word: 'existence', definition: 'The state of being alive or real', example: 'Scientists debate the existence of life on other planets.' },
  { word: 'experience', definition: 'Something that happens to you', example: 'Traveling is a wonderful experience.' },
  { word: 'independent', definition: 'Not needing help from others', example: 'Cats are very independent animals.' },
  { word: 'judgment', definition: 'A decision or opinion', example: 'Use good judgment when making choices.' },
  { word: 'knowledge', definition: 'Things you know and understand', example: 'Books are a great source of knowledge.' },
  { word: 'language', definition: 'Words used by a group of people', example: 'She speaks three different languages fluently.' },
  { word: 'library', definition: 'A place with books to borrow', example: 'I borrowed five books from the library.' },
  { word: 'license', definition: 'Official permission to do something', example: 'You need a license to drive a car.' },
  { word: 'lieutenant', definition: 'A military or police officer rank', example: 'The lieutenant led the soldiers into training.' },
  { word: 'maintenance', definition: 'Keeping something in good condition', example: 'Regular maintenance keeps your car running well.' },
  { word: 'millennium', definition: 'A period of one thousand years', example: 'The new millennium started in the year 2000.' },
  { word: 'miniature', definition: 'A very small version of something', example: 'She collects miniature figurines of horses.' },
  { word: 'miscellaneous', definition: 'A mix of different things', example: 'The drawer was full of miscellaneous items.' },
  { word: 'neighbor', definition: 'Someone who lives near you', example: 'Our neighbor brought us cookies when we moved in.' },
];

// Export just the word strings for backwards compatibility
export const grade5WordStrings: string[] = grade5Words.map(w => w.word);

export default grade5Words;
