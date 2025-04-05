document.addEventListener('DOMContentLoaded', function() {
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
    
    const today = new Date().toDateString();
    if (userData.accuracy.lastReset !== today) {
        userData.accuracy = {
            correct: 0,
            total: 0,
            lastReset: today
        };
        localStorage.setItem('mathGameUser', JSON.stringify(userData));
    }
    
    updateUserStats();
    
    // Topic selection
    document.getElementById('addition').addEventListener('click', () => startGame('addition'));
    document.getElementById('subtraction').addEventListener('click', () => startGame('subtraction'));
    // Add these to your existing event listeners
document.getElementById('multiplication').addEventListener('click', () => selectTopic('multiplication'));
document.getElementById('division').addEventListener('click', () => selectTopic('division'));
    // Powerup purchases
    document.getElementById('fifty-fifty').addEventListener('click', () => purchasePowerup('fiftyFifty', 50));
    document.getElementById('freeze-time').addEventListener('click', () => purchasePowerup('freezeTime', 75));
    
    function updateUserStats() {
        const accuracy = userData.accuracy.total > 0 
            ? Math.round((userData.accuracy.correct / userData.accuracy.total) * 100)
            : 0;
        
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        document.getElementById('coins').textContent = userData.coins;
    }
    
    function startGame(topic) {
        sessionStorage.setItem('selectedTopic', topic);
        window.location.href = 'game.html';
    }
    
    function purchasePowerup(powerup, cost) {
        if (userData.coins >= cost) {
            userData.coins -= cost;
            userData.powerups[powerup] += 1;
            localStorage.setItem('mathGameUser', JSON.stringify(userData));
            updateUserStats();
            alert(`You've purchased a ${powerup === 'fiftyFifty' ? '50/50' : 'Freeze Time'} powerup!`);
        } else {
            alert("You don't have enough coins for this powerup!");
        }
    }
});