const chatbox = document.getElementById('chatbox');
const userInput = document.getElementById('userInput');
const themeToggle = document.getElementById('themeToggle');
const modelSelect = document.getElementById('modelSelect');
const modelDropdown = document.getElementById('modelDropdown');
const currentModelSpan = document.getElementById('currentModel');
const stopButton = document.getElementById('stopButton');
const clearButton = document.getElementById('clearButton');
const showHistoryButton = document.getElementById('showHistoryButton');
const tokensPerSecondElement = document.getElementById('tokensPerSecond');

let currentModel = localStorage.getItem('currentModel') || 'gemma3:27b';
let currentController = null;
let conversationHistory = [];
let isShowingHistory = false;
let lastChatContent = '';
let lastTimestamp = null;
let lastTokenCount = 0;
let tokenRates = []; // Array to store recent token rates
const MAX_RATES = 5; // Number of rates to average

// Add temperature control
let currentTemperature = parseFloat(localStorage.getItem('temperature')) || 0.7;

// Create temperature control elements
const temperatureControl = document.createElement('div');
temperatureControl.className = 'model-selector';
temperatureControl.innerHTML = `
    <button class="control-button">
        <span class="temperature-icon">🌡️</span>
        <span id="currentTemp">${currentTemperature.toFixed(1)}</span>
    </button>
    <div class="dropdown-content temperature-dropdown">
        <div style="padding: 10px;">
            <input type="range" id="tempSlider" min="0" max="1" step="0.1" value="${currentTemperature}">
            <div style="text-align: center; margin-top: 5px;">Temperature: <span id="tempValue">${currentTemperature.toFixed(1)}</span></div>
        </div>
    </div>
`;

// Insert temperature control after model selector
document.querySelector('.top-controls').insertBefore(
    temperatureControl,
    document.querySelector('.model-selector').nextSibling
);

// Temperature control handling
const tempSlider = document.getElementById('tempSlider');
const tempValue = document.getElementById('tempValue');
const currentTemp = document.getElementById('currentTemp');

tempSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    currentTemperature = value;
    tempValue.textContent = value.toFixed(1);
    currentTemp.textContent = value.toFixed(1);
    localStorage.setItem('temperature', value);
});

// Add temperature dropdown toggle
temperatureControl.querySelector('.control-button').addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = temperatureControl.classList.contains('active');
    temperatureControl.classList.toggle('active');
});

// Show history functionality
function formatHistoryForDisplay() {
    let formattedHistory = '# Conversation History\n\n';
    conversationHistory.forEach((msg, index) => {
        if (msg.role === 'user') {
            formattedHistory += `### User Message ${Math.floor(index/2) + 1}:\n${msg.content}\n\n`;
        } else {
            formattedHistory += `### AI Response ${Math.floor(index/2) + 1}:\n${msg.content}\n\n`;
        }
    });
    return formattedHistory;
}

showHistoryButton.addEventListener('click', () => {
    if (isShowingHistory) {
        // If already showing history, return to chat
        chatbox.innerHTML = lastChatContent;
        chatbox.scrollTop = chatbox.scrollHeight;
        isShowingHistory = false;
        showHistoryButton.innerHTML = '<span class="history-icon">📜</span>Show History';
    } else {
        // Store current chat content
        lastChatContent = chatbox.innerHTML;
        isShowingHistory = true;
        showHistoryButton.innerHTML = '<span class="history-icon">💬</span>Back to Chat';
        
        // Create container for history view
        const historyContainer = document.createElement('div');
        historyContainer.className = 'history-view';
        
        // Add history content
        const historyContent = formatHistoryForDisplay();
        const htmlContent = DOMPurify.sanitize(marked.parse(historyContent, {
            gfm: true,
            breaks: true
        }));
        
        // Set up history view
        historyContainer.innerHTML = htmlContent;
        chatbox.innerHTML = '';
        chatbox.appendChild(historyContainer);
        chatbox.scrollTop = 0;
    }
});

// Chat history handling
function saveChatHistory() {
    const messages = [];
    chatbox.childNodes.forEach(node => {
        if (node.textContent.startsWith('You: ')) {
            messages.push({ role: 'user', content: node.textContent.substring(5) });
        } else if (node.className === 'ai-response') {
            const aiContent = node.querySelector('.markdown-content').innerHTML;
            messages.push({ role: 'assistant', content: aiContent });
        }
    });
    localStorage.setItem('chatHistory', JSON.stringify(messages));
    conversationHistory = messages;
}

function loadChatHistory() {
    const history = localStorage.getItem('chatHistory');
    if (history) {
        const messages = JSON.parse(history);
        conversationHistory = messages;
        messages.forEach(msg => {
            if (msg.role === 'user') {
                const userMessageElement = document.createElement('p');
                userMessageElement.textContent = `You: ${msg.content}`;
                chatbox.appendChild(userMessageElement);
            } else if (msg.role === 'assistant') {
                const aiContainer = document.createElement('div');
                aiContainer.className = 'ai-response';
                const aiPrefix = document.createElement('strong');
                aiPrefix.textContent = 'AI: ';
                const aiContent = document.createElement('div');
                aiContent.className = 'markdown-content';
                aiContent.style.display = 'inline';
                aiContent.innerHTML = msg.content;
                aiContainer.appendChild(aiPrefix);
                aiContainer.appendChild(aiContent);
                chatbox.appendChild(aiContainer);
            }
        });
        chatbox.scrollTop = chatbox.scrollHeight;
    }
}

// Initialize chat history
loadChatHistory();

// Theme handling
function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeToggle.innerHTML = isDark ? '🌜 Dark Mode' : '🌞 Light Mode';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme === 'dark');

// Theme toggle handler
themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'light';
    setTheme(isDark);
});

// Model selection handling
async function fetchModels() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        return data.models;
    } catch (error) {
        console.error('Failed to fetch models:', error);
        return [];
    }
}

function updateModelList(models) {
    modelDropdown.innerHTML = '';
    models.forEach(model => {
        const modelDiv = document.createElement('div');
        modelDiv.textContent = model.name;
        if (model.name === currentModel) {
            modelDiv.classList.add('selected');
            currentModelSpan.textContent = model.name;
        }
        modelDiv.addEventListener('click', () => {
            currentModel = model.name;
            localStorage.setItem('currentModel', model.name);
            currentModelSpan.textContent = model.name;
            document.querySelectorAll('.dropdown-content div').forEach(div => {
                div.classList.remove('selected');
            });
            modelDiv.classList.add('selected');
            modelSelect.parentElement.classList.remove('active');
        });
        modelDropdown.appendChild(modelDiv);
    });
}

// Toggle dropdown
modelSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = modelSelect.parentElement.classList.contains('active');
    modelSelect.parentElement.classList.toggle('active');
    
    if (!isActive) {
        fetchModels().then(updateModelList);
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    modelSelect.parentElement.classList.remove('active');
});

modelDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Initialize models
fetchModels().then(updateModelList);

// Add marked and DOMPurify CDN imports
const markedScript = document.createElement('script');
markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
document.head.appendChild(markedScript);

const purifyScript = document.createElement('script');
purifyScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.9/purify.min.js';
document.head.appendChild(purifyScript);

// Clear chat history
clearButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
        chatbox.innerHTML = '';
        localStorage.removeItem('chatHistory');
        conversationHistory = [];
        if (currentController) {
            currentController.abort();
            currentController = null;
            stopButton.disabled = true;
        }
        // Reset history view state
        isShowingHistory = false;
        lastChatContent = '';
        showHistoryButton.innerHTML = '<span class="history-icon">📜</span>Show History';
    }
});

// Stop generation
stopButton.addEventListener('click', () => {
    if (currentController) {
        currentController.abort();
        currentController = null;
        stopButton.disabled = true;
    }
});

function buildPrompt(message) {
    let prompt = '';
    
    // Add conversation history to the prompt
    conversationHistory.forEach(msg => {
        if (msg.role === 'user') {
            prompt += `Human: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
            // Strip HTML from assistant responses
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = msg.content;
            prompt += `Assistant: ${tempDiv.textContent}\n\n`;
        }
    });
    
    // Add the current message
    prompt += `Human: ${message}\n\nAssistant: `;
    return prompt;
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    userInput.value = '';
    stopButton.disabled = false;
    tokensPerSecondElement.textContent = '0';
    lastTimestamp = null;
    lastTokenCount = 0;
    tokenRates = []; // Reset token rates array

    // Display user message
    const userMessageElement = document.createElement('p');
    userMessageElement.textContent = `You: ${message}`;
    chatbox.appendChild(userMessageElement);
    chatbox.scrollTop = chatbox.scrollHeight;

    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: message });

    // Create AI response container with markdown support
    const aiContainer = document.createElement('div');
    aiContainer.className = 'ai-response';
    const aiPrefix = document.createElement('strong');
    aiPrefix.textContent = 'AI: ';
    const aiContent = document.createElement('div');
    aiContent.className = 'markdown-content';
    aiContent.style.display = 'inline';
    aiContainer.appendChild(aiPrefix);
    aiContainer.appendChild(aiContent);
    chatbox.appendChild(aiContainer);

    try {
        // Create new AbortController for this request
        currentController = new AbortController();
        
        // Send request to Ollama API with conversation history and temperature
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: currentModel,
                prompt: buildPrompt(message),
                stream: true,
                options: {
                    temperature: currentTemperature
                }
            }),
            signal: currentController.signal
        });

        let accumulatedText = '';
        
        // Handle streaming response
        const reader = response.body.getReader();
        while (true) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    // Add assistant response to conversation history
                    conversationHistory.push({ role: 'assistant', content: aiContent.innerHTML });
                    saveChatHistory();
                    break;
                }

                const text = new TextDecoder('utf-8').decode(value);
                const data = JSON.parse(text);
                accumulatedText += data.response;
                
                // Calculate tokens per second using timestamps
                if (data.created_at) {
                    const currentTime = new Date(data.created_at).getTime();
                    if (lastTimestamp) {
                        const timeDiff = (currentTime - lastTimestamp) / 1000; // Convert to seconds
                        const tokenDiff = data.response.length / 4; // Approximate token count (4 chars per token)
                        const currentRate = tokenDiff / timeDiff;
                        
                        // Add current rate to the array
                        tokenRates.push(currentRate);
                        if (tokenRates.length > MAX_RATES) {
                            tokenRates.shift(); // Remove oldest rate
                        }
                        
                        // Calculate and display average rate
                        const averageRate = tokenRates.reduce((a, b) => a + b, 0) / tokenRates.length;
                        tokensPerSecondElement.textContent = averageRate.toFixed(1);
                    }
                    lastTimestamp = currentTime;
                }
                
                // Convert markdown to HTML with sanitization
                const htmlContent = DOMPurify.sanitize(marked.parse(accumulatedText, {
                    gfm: true,
                    breaks: true
                }));
                
                aiContent.innerHTML = htmlContent;
                chatbox.scrollTop = chatbox.scrollHeight;
            } catch (e) {
                if (e.name === 'AbortError') {
                    aiContent.innerHTML += '\n\n*Generation stopped by user*';
                    conversationHistory.push({ role: 'assistant', content: aiContent.innerHTML });
                    saveChatHistory();
                    break;
                }
                console.error('Failed to parse JSON:', e);
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            aiContent.innerHTML += '\n\n*Generation stopped by user*';
        } else {
            console.error('Failed to send message:', e);
            aiContent.innerHTML += '\n\n*Error: Failed to generate response*';
        }
        conversationHistory.push({ role: 'assistant', content: aiContent.innerHTML });
        saveChatHistory();
    } finally {
        currentController = null;
        stopButton.disabled = true;
    }
}

// Handle keyboard events
userInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        if (e.shiftKey) {
            // Don't prevent default - allow new line
            return;
        } else {
            e.preventDefault();
            await sendMessage();
        }
    }
});

// Add some basic styles for markdown
const style = document.createElement('style');
style.textContent = `
    .markdown-content {
        line-height: 1.5;
    }
    .markdown-content code {
        background-color: var(--code-bg);
        padding: 2px 4px;
        border-radius: 4px;
        font-family: monospace;
    }
    .markdown-content pre {
        background-color: var(--pre-bg);
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
    }
    .markdown-content p {
        margin: 0.5em 0;
    }
    .markdown-content ul, .markdown-content ol {
        margin: 0.5em 0;
        padding-left: 2em;
    }
    .markdown-content blockquote {
        border-left: 4px solid var(--blockquote-border);
        margin: 0;
        padding-left: 1em;
        color: var(--blockquote-color);
    }
    .temperature-dropdown {
        min-width: 150px !important;
    }
    
    #tempSlider {
        width: 100%;
    }
    
    .temperature-icon {
        font-size: 14px;
    }
`;
document.head.appendChild(style);
