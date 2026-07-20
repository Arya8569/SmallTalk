-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL
);

-- Create recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id INT REFERENCES topics(id) ON DELETE CASCADE,
    audio_url TEXT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    feedback_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create a helper function to fetch a random topic filtered by categories
CREATE OR REPLACE FUNCTION get_random_topic(categories_filter TEXT[], exclude_ids INT[] DEFAULT '{}')
RETURNS SETOF topics AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM topics
    WHERE category = ANY(categories_filter)
      AND NOT (id = ANY(exclude_ids))
    ORDER BY random()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous select for topics (necessary for the public frontend)
CREATE POLICY "Allow public read access to topics" ON topics
    FOR SELECT TO anon USING (true);

-- Allow anonymous insert/select for recordings
CREATE POLICY "Allow public insert to recordings" ON recordings
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public read access to recordings" ON recordings
    FOR SELECT TO anon USING (true);

-- Truncate topics table if it exists to ensure fresh seed
TRUNCATE TABLE topics CASCADE;

-- Seed topics: 30 topics for each category
INSERT INTO topics (category, prompt) VALUES
-- 1. Casual / Icebreakers
('Casual', 'If you could invent a new holiday, what would it be about and how would people celebrate it?'),
('Casual', 'What is a small, simple pleasure that instantly makes your day better?'),
('Casual', 'If you could swap lives with your pet for a day, what do you think they would do in your body?'),
('Casual', 'What is the strangest food combination you secretly enjoy?'),
('Casual', 'If your life was a sitcom, what would the title be and what would be the plot of the pilot episode?'),
('Casual', 'What is the most useless talent you possess?'),
('Casual', 'If you had to eat the exact same meal every day for the rest of your life, what would you choose?'),
('Casual', 'What is the funniest thing that has ever happened to you as a child?'),
('Casual', 'If you were an alien visiting Earth for the first time, what human habit would confuse you the most?'),
('Casual', 'If you could be any animal for a day, which one would you choose and why?'),
('Casual', 'If you could instantly speak any language fluently, which one would it be and why?'),
('Casual', 'What is the absolute worst movie you have ever watched from start to finish?'),
('Casual', 'If you could time travel to any music concert in history, who would you go see?'),
('Casual', 'What is your absolute favorite way to waste time on a lazy Sunday?'),
('Casual', 'If you were a superhero, what minor, non-world-saving power would you want?'),
('Casual', 'What is the most memorable gift you have ever received from a friend?'),
('Casual', 'If you could build your dream house anywhere in the world, where would it be?'),
('Casual', 'What is a popular trend right now that you completely fail to understand?'),
('Casual', 'If you could change your first name, what name would you choose for yourself?'),
('Casual', 'Describe the perfect weekend getaway in as much detail as possible.'),
('Casual', 'What is the most adventurous thing you have ever done on a whim?'),
('Casual', 'If you could have dinner with any fictional character, who would it be?'),
('Casual', 'What is your favorite childhood memory that always brings a smile to your face?'),
('Casual', 'If you could instantly master any musical instrument, which one would it be?'),
('Casual', 'What is a piece of clothing you own that you refuse to throw away, no matter how old it gets?'),
('Casual', 'If you won a million dollars today, what is the very first thing you would buy?'),
('Casual', 'What is the most unusual place you have ever visited?'),
('Casual', 'If your current mood could be described as a color, what color would it be and why?'),
('Casual', 'What is the best board game or card game to play with a group of friends?'),
('Casual', 'If you could have an unlimited supply of one snack item, what would it be?'),

-- 2. Professional / Interview Prep
('Professional', 'Describe the most useful piece of professional advice you have ever ignored and what you learned from it.'),
('Professional', 'How do you prioritize tasks when everything seems urgent?'),
('Professional', 'Describe a time you pushed back on a decision at work and were ultimately proven right.'),
('Professional', 'What is the most underrated skill in your industry right now?'),
('Professional', 'How do you handle receiving feedback that you completely disagree with?'),
('Professional', 'Do you believe remote work is genuinely sustainable for your role long-term?'),
('Professional', 'What is a work habit you had to actively unlearn to become successful?'),
('Professional', 'How would you describe your management or leadership style in three words?'),
('Professional', 'Why does discipline beat motivation every single time in a professional setting?'),
('Professional', 'If you could change one fundamental rule about modern corporate culture, what would it be?'),
('Professional', 'How do you define a truly successful career?'),
('Professional', 'Describe a time you failed at a professional task and how you rebounded.'),
('Professional', 'What is the most effective way to deal with a difficult coworker or teammate?'),
('Professional', 'How do you keep yourself organized and focused in a high-distraction work environment?'),
('Professional', 'Is a university degree still necessary for a successful career in tech today?'),
('Professional', 'What does it mean to be a good team player in a fast-paced environment?'),
('Professional', 'How do you manage the balance between speed and quality when delivering a project?'),
('Professional', 'What is your strategy for preparing for a high-stakes job interview?'),
('Professional', 'How do you stay updated with rapidly changing trends in your professional field?'),
('Professional', 'What is the most important lesson you learned from your very first job or internship?'),
('Professional', 'Should companies enforce a strict 4-day workweek even if it reduces operational hours?'),
('Professional', 'How do you handle the pressure of working under tight deadlines?'),
('Professional', 'What is the value of mentorship, and have you ever had a mentor who changed your perspective?'),
('Professional', 'How do you approach learning a completely new technical skill from scratch?'),
('Professional', 'What is the role of emotional intelligence in modern workplace leadership?'),
('Professional', 'Is it better to be a generalist who knows a bit of everything or a deep specialist?'),
('Professional', 'How do you handle a situation where you realize you made a major mistake at work?'),
('Professional', 'What is the biggest myth people believe about working in the tech industry?'),
('Professional', 'How do you maintain professional boundaries while building close friendships at work?'),
('Professional', 'What is the single most important trait a manager should possess to inspire their team?'),

-- 3. Technology & Future
('Technology', 'Will artificial intelligence ultimately create more jobs than it destroys?'),
('Technology', 'If you had to eliminate one piece of modern technology completely, what would it be?'),
('Technology', 'Is privacy completely dead in the modern digital era?'),
('Technology', 'How will virtual reality change the way human beings build long-distance relationships?'),
('Technology', 'Should coding be taught as a core mandatory language in primary schools?'),
('Technology', 'Has social media done more harm or more good for society?'),
('Technology', 'Do you believe humanity should prioritize settling on Mars?'),
('Technology', 'How has automation affected the modern job market?'),
('Technology', 'What are the ethical implications of using AI technology in healthcare?'),
('Technology', 'If cars could talk, what would they complain about the most?'),
('Technology', 'Will physical books completely disappear in favor of digital reading devices?'),
('Technology', 'How is quantum computing going to reshape cryptography and data security?'),
('Technology', 'Should there be international laws regulating the development of autonomous military AI?'),
('Technology', 'How has the smartphone altered the cognitive attention span of the average human being?'),
('Technology', 'What will smart homes look like 20 years from now?'),
('Technology', 'Is blockchain technology genuinely useful beyond cryptocurrency applications?'),
('Technology', 'Should internet access be classified as a basic universal human right?'),
('Technology', 'How will synthetic biology and genetic editing alter the future of human evolution?'),
('Technology', 'Are we becoming too dependent on algorithms to make everyday personal decisions?'),
('Technology', 'What is the most exciting technological breakthrough you expect to see in your lifetime?'),
('Technology', 'How can technology be better leveraged to combat global climate change?'),
('Technology', 'Will brick-and-mortar retail stores completely vanish due to e-commerce?'),
('Technology', 'Should tech monopolies be actively broken up by government regulations?'),
('Technology', 'How is deepfake technology changing our relationship with visual evidence and truth?'),
('Technology', 'What are the pros and cons of wearable health-tracking tech on our mental health?'),
('Technology', 'Will humanoid robots become a standard household fixture by the next decade?'),
('Technology', 'How does the digital divide affect developing nations in an increasingly online world?'),
('Technology', 'What is your opinion on neural interfaces that connect the human brain directly to computers?'),
('Technology', 'Should open-source software development receive government funding and protection?'),
('Technology', 'How has the rise of streaming platforms changed the structural art of filmmaking?'),

-- 4. Philosophy & Deep Thoughts
('Philosophy', 'If you could know the exact date and time of your death, would you want to know it?'),
('Philosophy', 'Does true altruism exist, or is every good deed driven by a selfish motive?'),
('Philosophy', 'What is the difference between simply existing and actually living?'),
('Philosophy', 'If you could pause time for everyone except yourself for 24 hours, what would you do?'),
('Philosophy', 'Does money genuinely buy security, comfort, or true happiness?'),
('Philosophy', 'What do you think it means to live a meaningful life?'),
('Philosophy', 'If we learn from our mistakes, why are we always so afraid to make them?'),
('Philosophy', 'Is it more important to love or to be loved?'),
('Philosophy', 'What is a belief you held strongly that has completely changed in the last five years?'),
('Philosophy', 'If you could instill one piece of advice in a newborn baby’s mind, what would it be?'),
('Philosophy', 'If absolute power corrupts absolutely, can a truly good leader ever exist?'),
('Philosophy', 'Does destiny dictate our lives, or are we completely free to choose our own paths?'),
('Philosophy', 'If you could achieve immortality but could never die under any circumstance, would you take it?'),
('Philosophy', 'What is the nature of true justice, and does our modern legal system achieve it?'),
('Philosophy', 'Is human nature inherently good, inherently bad, or completely neutral at birth?'),
('Philosophy', 'If a tree falls in a forest and no one is around to hear it, does it make a sound?'),
('Philosophy', 'Can an artificial consciousness ever possess a soul or human-like rights?'),
('Philosophy', 'What is the value of suffering? Can a person truly grow without experiencing pain?'),
('Philosophy', 'If you could have the absolute answer to one historical mystery, what would you ask?'),
('Philosophy', 'Is it better to live a short, incredibly exciting life or a long, peaceful, quiet one?'),
('Philosophy', 'How do you define the boundary between right and wrong behavior?'),
('Philosophy', 'If you could change one event in past world history, would you risk the butterfly effect?'),
('Philosophy', 'What is the most beautiful thing about the human experience?'),
('Philosophy', 'Does time flow linearly, or is our perception of past, present, and future an illusion?'),
('Philosophy', 'Is absolute freedom a good thing, or do human beings require structural boundaries?'),
('Philosophy', 'What is the purpose of art in a world that values practical functionality?'),
('Philosophy', 'If you found out your entire life was a highly realistic computer simulation, would it change how you live?'),
('Philosophy', 'Is peace simply the absence of war, or is it something deeper within society?'),
('Philosophy', 'What is the weight of a secret? Is it ever morally acceptable to keep a massive secret from a loved one?'),
('Philosophy', 'If tomorrow the world lost all shared memory of money, how would human value be determined?'),

-- 5. Personal Growth
('Personal Growth', 'What is something you have had to let go of in order to grow?'),
('Personal Growth', 'Describe a moment in your life when you truly felt proud of yourself.'),
('Personal Growth', 'What is the smallest brave thing you did this month?'),
('Personal Growth', 'What is a small habit that you believe has completely transformed your day-to-day life?'),
('Personal Growth', 'How do you personally handle intense periods of burnout or stress?'),
('Personal Growth', 'Describe the moment you realized adults were just guessing most of the time.'),
('Personal Growth', 'What is the most impactful book or movie you have ever experienced, and why?'),
('Personal Growth', 'What is something you thought would be easy but turned out to be really difficult?'),
('Personal Growth', 'When do you feel the most at peace with yourself?'),
('Personal Growth', 'What is one thing you would like to learn how to do really well?'),
('Personal Growth', 'How do you maintain self-discipline when you have zero motivation?'),
('Personal Growth', 'What does it mean to step out of your comfort zone, and when did you last do it?'),
('Personal Growth', 'How do you handle the fear of missing out (FOMO) in a highly connected social landscape?'),
('Personal Growth', 'What is the value of spending time completely alone with your thoughts?'),
('Personal Growth', 'Describe a major goal you set for yourself that you failed to achieve, and what happened next.'),
('Personal Growth', 'How do you define personal boundaries, and how do you protect them?'),
('Personal Growth', 'What is a personal weakness you are actively working to improve right now?'),
('Personal Growth', 'How do you stop yourself from comparing your progress to the success of others?'),
('Personal Growth', 'What is the most constructive way to deal with constructive criticism?'),
('Personal Growth', 'How has your definition of success changed as you have gotten older?'),
('Personal Growth', 'What is an unconventional habit you have that actually helps your productivity?'),
('Personal Growth', 'How do you practice gratitude in your daily routine?'),
('Personal Growth', 'What does it mean to be truly authentic to yourself?'),
('Personal Growth', 'Describe a risk you took that completely changed the trajectory of your life.'),
('Personal Growth', 'How do you filter out negative energy or toxic mindsets from your immediate circle?'),
('Personal Growth', 'What is the importance of learning how to say "no" without feeling guilty?'),
('Personal Growth', 'How do you recover from a creative block or mental exhaustion?'),
('Personal Growth', 'What is a piece of advice you would give to your younger self five years ago?'),
('Personal Growth', 'How do you remain resilient when multiple aspects of your life hit a rough patch at once?'),
('Personal Growth', 'What is the best way to celebrate your small wins without losing focus on the big goal?'),

-- 6. Culture & Society
('Culture & Society', 'Should traveling abroad be a mandatory prerequisite before entering a university or job market?'),
('Culture & Society', 'How has social media changed our definition of a true friend?'),
('Culture & Society', 'What is one cultural tradition from your hometown that you think the rest of the world should adopt?'),
('Culture & Society', 'Are modern books and reading losing their relevance in the age of short-form video content?'),
('Culture & Society', 'If you could change one major law or societal rule in your country overnight, what would it be?'),
('Culture & Society', 'Why is renting becoming more favorable than owning a home for anyone under 30?'),
('Culture & Society', 'Are professional athletes overpaid for what they do?'),
('Culture & Society', 'Do school uniforms limit individuality or level the playing field?'),
('Culture & Society', 'Should parents be allowed to choose their child’s gender or genetic traits?'),
('Culture & Society', 'Why do manners and etiquette still matter in modern society?'),
('Culture & Society', 'How has globalization impacted unique indigenous cultures around the world?'),
('Culture & Society', 'Should public transportation within mega-cities be entirely free for residents?'),
('Culture & Society', 'What is the cultural significance of food in bringing diverse communities together?'),
('Culture & Society', 'Has the concept of local community been broken by online global forums?'),
('Culture & Society', 'Should modern architecture prioritize historical preservation or futuristic utility?'),
('Culture & Society', 'How does advertising manipulate societal definitions of beauty and status?'),
('Culture & Society', 'Is the modern educational system failing to prepare students for real-world life skills?'),
('Culture & Society', 'What is the impact of celebrity culture on the political opinions of young citizens?'),
('Culture & Society', 'Should volunteering at a local charity or community center be mandatory for high school graduation?'),
('Culture & Society', 'How has the definition of family evolved over the past fifty years?'),
('Culture & Society', 'Is fast fashion causing a cultural crisis in how we value sustainable craftsmanship?'),
('Culture & Society', 'What role should museums play in returning historical artifacts to their countries of origin?'),
('Culture & Society', 'How do stereotypes perpetuated by media affect minority populations?'),
('Culture & Society', 'Should standard working hours adapt dynamically to seasonal weather changes?'),
('Culture & Society', 'Why are subcultures and countercultures vital to the health of mainstream society?'),
('Culture & Society', 'How does the layout of a city affect the overall mental health of its citizens?'),
('Culture & Society', 'Should high-speed rail networks replace domestic short-haul flights entirely?'),
('Culture & Society', 'What is the societal consequence of a declining birth rate across major modern nations?'),
('Culture & Society', 'How do generation gaps create friction in passing down traditional values?'),
('Culture & Society', 'Should public spaces be entirely free from commercial advertising?');
