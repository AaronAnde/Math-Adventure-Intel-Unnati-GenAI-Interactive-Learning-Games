document.addEventListener('DOMContentLoaded', function() {
   
    const CONFIG = {
        API_KEY: "", 
        MAX_RETRIES: 2,
        TIME_PER_QUESTION: 30,
        QUESTIONS_PER_LEVEL: 5,
        FALLBACK_QUESTIONS: {
            addition: [
                {
                    story: "Emma has 8 apples. She buys 5 more at the store. How many apples does she have now?",
                    options: ["12 apples", "13 apples", "14 apples", "15 apples"],
                    correctIndex: 1
                }
            ],
            subtraction: [
                {
                    story: "James has 15 candies. He gives 6 to his friend. How many candies does he have left?",
                    options: ["7 candies", "8 candies", "9 candies", "10 candies"],
                    correctIndex: 2
                }
            ]
        }
    };

    const gameState = {
        level: 1,
        questionsAnswered: 0,
        correctAnswers: 0,
        currentQuestion: null,
        timer: CONFIG.TIME_PER_QUESTION,
        timerInterval: null,
        coins: 0,
        powerups: {
            fiftyFifty: 0,
            freezeTime: 0
        },
        usedFiftyFifty: false,
        currentRetries: 0
    };

    const userData = JSON.parse(localStorage.getItem('mathGameUser')) || {
        coins: 0,
        powerups: {
            fiftyFifty: 0,
            freezeTime: 0
        }
    };
    
    gameState.coins = userData.coins;
    gameState.powerups = userData.powerups;
    const selectedTopic = sessionStorage.getItem('selectedTopic') || 'addition';

    updateGameStats();
    setupPowerupButtons();
    startTimer();
    generateQuestion(selectedTopic);

    document.getElementById('use-fifty-fifty').addEventListener('click', useFiftyFifty);
    document.getElementById('use-freeze-time').addEventListener('click', useFreezeTime);


    async function generateQuestion(topic) {
        console.log("Testing API key...");
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${CONFIG.API_KEY}`;
    const testResponse = await fetch(testUrl);
    console.log("API connection test:", await testResponse.json());
        try {
            showLoadingState();
            const question = await tryGenerateAIQuestion(topic);
            gameState.currentQuestion = question;
            
            displayQuestion(question);
            gameState.usedFiftyFifty = false;
            gameState.currentRetries = 0;
            updateGameStats();
            
        } catch (error) {
            console.error("Question generation failed:", error);
            handleGenerationError(topic, error);
        }
    }

    async function tryGenerateAIQuestion(topic) {
        const themes = [
            "animals", "space", "school", "sports", "food", 
            "shopping", "nature", "transportation", "holidays", "games"
        ];
        const contexts = [
            "a word problem", 
            "a real-world scenario", 
            "a story problem",
            "a practical application",
            "a fun math challenge"
        ];
        const difficultyDescriptors = [
            "simple", "moderate", "challenging", "thought-provoking", "engaging"
        ];
        
        const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
        const selectedContext = contexts[Math.floor(Math.random() * contexts.length)];
        const selectedDifficulty = difficultyDescriptors[Math.floor(Math.random() * difficultyDescriptors.length)];
    
        const prompt = `Create ${selectedDifficulty} ${selectedContext} about ${selectedTheme} that requires ${topic} to solve. Follow these requirements:
        1. Create a unique, creative scenario (1-2 sentences)
        2. Use numbers between ${getNumberRange(topic)}
        3. Generate 4 plausible multiple choice options (labeled A-D)
        4. Mark the correct answer (correctIndex 0-3)
        5. Ensure the question hasn't been used before
        6. Format response as JSON:
        {
            "story": "Story context...",
            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
            "correctIndex": 1,
            "uniqueId": "theme-topic-keyword"
        }`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.API_KEY}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 300
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API error details:", errorData);
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            console.log("Full API response:", data);
            
            if (!data.candidates || !data.candidates[0].content.parts[0].text) {
                throw new Error("Invalid response format from Gemini");
            }

            const generatedText = data.candidates[0].content.parts[0].text;
            const jsonStart = generatedText.indexOf('{');
            const jsonEnd = generatedText.lastIndexOf('}') + 1;
            
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error("No JSON found in response");
            }

            const jsonString = generatedText.slice(jsonStart, jsonEnd);
            let content;
            
            try {
                content = JSON.parse(jsonString);
            } catch (e) {
                throw new Error("Failed to parse JSON: " + e.message);
            }

            if (!content.story || !content.options || content.correctIndex === undefined) {
                throw new Error("Invalid question format from AI");
            }
     
            content.options = content.options.map(opt => 
                opt.replace(/^[A-D]\)\s*/i, '').replace(/\s*\(correct\)/i, '')
            );
            
            return content;
            
        } catch (error) {
            console.error("Gemini API error:", error);
            throw error;
        }
    }
    function getNumberRange(topic) {
        const ranges = {
            addition: "10-100",
            subtraction: "10-100",
            multiplication: "2-12 for factors, up to 144 for product",
            division: "2-12 for divisors, up to 144 for dividend"
        };
        return ranges[topic] || "5-50";
    }
    function handleGenerationError(topic, error) {
        gameState.currentRetries++;
        console.error(`Generation Error (attempt ${gameState.currentRetries}):`, error);
        
        if (gameState.currentRetries <= CONFIG.MAX_RETRIES) {
            document.getElementById('question-text').textContent = `Creating question (try ${gameState.currentRetries})...`;
            setTimeout(() => generateQuestion(topic), 1000);
        } else {
            console.warn("Max retries reached - using fallback");
            useFallbackQuestion(topic);
        }
    }

    function useFallbackQuestion(topic) {
        const questions = CONFIG.FALLBACK_QUESTIONS[topic];
        const randomIndex = Math.floor(Math.random() * questions.length);
        gameState.currentQuestion = questions[randomIndex];
        
        console.warn("Using fallback question:", gameState.currentQuestion);
        displayQuestion(gameState.currentQuestion);
        gameState.currentRetries = 0;
        updateGameStats();
    }


    function showLoadingState() {
        document.getElementById('question-text').textContent = "Creating your math adventure...";
        document.getElementById('options-container').innerHTML = '';
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback';
    }

    function displayQuestion(question) {
        document.getElementById('question-text').textContent = question.story;
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.dataset.index = index;
            button.addEventListener('click', () => checkAnswer(index));
            optionsContainer.appendChild(button);
        });
    }

    function checkAnswer(selectedIndex) {
        clearInterval(gameState.timerInterval);
        
        const correctIndex = gameState.currentQuestion.correctIndex;
        const isCorrect = selectedIndex === correctIndex;
        
        gameState.questionsAnswered++;
        if (isCorrect) {
            gameState.correctAnswers++;
            gameState.coins += 20;
        }
        
        showFeedback(isCorrect ? "Correct! 🎉" : "Incorrect 😢", isCorrect);
        
        const optionButtons = document.querySelectorAll('.option-btn');
        optionButtons.forEach((button, index) => {
            if (index === correctIndex) {
                button.classList.add('correct');
            } else if (index === selectedIndex && !isCorrect) {
                button.classList.add('incorrect');
            }
            button.disabled = true;
        });
        
        setTimeout(() => nextQuestion(selectedTopic), 2000);
    }

    function showFeedback(message, isCorrect) {
        const feedbackElement = document.getElementById('feedback');
        feedbackElement.textContent = message;
        feedbackElement.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    }

    function nextQuestion(topic) {
        if (gameState.questionsAnswered >= CONFIG.QUESTIONS_PER_LEVEL) {
            completeLevel();
            return;
        }
        
        startTimer();
        generateQuestion(topic);
    }

    function completeLevel() {
        const levelReward = 100;
        const accuracy = (gameState.correctAnswers / CONFIG.QUESTIONS_PER_LEVEL) * 100;
        
        const userData = JSON.parse(localStorage.getItem('mathGameUser')) || {
            coins: 0,
            accuracy: {
                correct: 0,
                total: 0,
                lastReset: new Date().toDateString()
            },
            powerups: {
                fiftyFifty: 0,
                freezeTime: 0
            }
        };
        
        userData.coins += levelReward;
        userData.accuracy.correct += gameState.correctAnswers;
        userData.accuracy.total += CONFIG.QUESTIONS_PER_LEVEL;
        userData.powerups = gameState.powerups;
        
        localStorage.setItem('mathGameUser', JSON.stringify(userData));
        
        alert(`Level ${gameState.level} complete!\nAccuracy: ${Math.round(accuracy)}%\nYou earned ${levelReward} coins!`);
        window.location.href = 'index.html';
    }

    function useFiftyFifty() {
        if (gameState.powerups.fiftyFifty > 0 && !gameState.usedFiftyFifty) {
            gameState.powerups.fiftyFifty--;
            gameState.usedFiftyFifty = true;
            
            const correctIndex = gameState.currentQuestion.correctIndex;
            const optionButtons = document.querySelectorAll('.option-btn');
            let wrongOptions = [];
            
            optionButtons.forEach((btn, index) => {
                if (index !== correctIndex) wrongOptions.push(btn);
            });
            
            wrongOptions.sort(() => 0.5 - Math.random());
            wrongOptions.slice(0, 2).forEach(btn => {
                btn.style.visibility = 'hidden';
            });
            
            updateGameStats();
        }
    }

    function useFreezeTime() {
        if (gameState.powerups.freezeTime > 0) {
            gameState.powerups.freezeTime--;
            gameState.timer += 10;
            document.getElementById('timer').textContent = gameState.timer;
            updateGameStats();
            
            showTemporaryFeedback("Time frozen +10 seconds!", true);
        }
    }

    function showTemporaryFeedback(message, isSuccess) {
        const feedbackElement = document.getElementById('feedback');
        feedbackElement.textContent = message;
        feedbackElement.className = `feedback ${isSuccess ? 'correct' : 'incorrect'}`;
        setTimeout(() => {
            feedbackElement.textContent = '';
            feedbackElement.className = 'feedback';
        }, 1500);
    }

    function updateGameStats() {
        document.getElementById('level').textContent = gameState.level;
        document.getElementById('timer').textContent = gameState.timer;
        document.getElementById('game-coins').textContent = gameState.coins;
        document.getElementById('progress-text').textContent = 
            `${gameState.questionsAnswered}/${CONFIG.QUESTIONS_PER_LEVEL}`;
        
        document.querySelector('.progress-bar').style.width = 
            `${(gameState.questionsAnswered / CONFIG.QUESTIONS_PER_LEVEL) * 100}%`;
        
        document.getElementById('use-fifty-fifty').disabled = 
            gameState.powerups.fiftyFifty <= 0 || gameState.usedFiftyFifty;
        document.getElementById('use-freeze-time').disabled = 
            gameState.powerups.freezeTime <= 0;
    }

    function setupPowerupButtons() {
        document.getElementById('use-fifty-fifty').disabled = gameState.powerups.fiftyFifty <= 0;
        document.getElementById('use-freeze-time').disabled = gameState.powerups.freezeTime <= 0;
    }

    function startTimer() {
        clearInterval(gameState.timerInterval);
        gameState.timer = CONFIG.TIME_PER_QUESTION;
        document.getElementById('timer').textContent = gameState.timer;
        
        gameState.timerInterval = setInterval(() => {
            gameState.timer--;
            document.getElementById('timer').textContent = gameState.timer;
            
            if (gameState.timer <= 0) {
                clearInterval(gameState.timerInterval);
                showFeedback("Time's up!", false);
                setTimeout(() => nextQuestion(selectedTopic), 1500);
            }
        }, 1000);
    }
});