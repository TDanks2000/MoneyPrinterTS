const videoSubject = document.querySelector('#videoSubject');
const aiModel = document.querySelector('#aiModel');
const voice = document.querySelector('#voice');
const zipUrl = document.querySelector('#zipUrl');
const paragraphNumber = document.querySelector('#paragraphNumber');
const youtubeToggle = document.querySelector('#youtubeUploadToggle');
const useMusicToggle = document.querySelector('#useMusicToggle');
const customPrompt = document.querySelector('#customPrompt');
const generateButton = document.querySelector('#generateButton');
const cancelButton = document.querySelector('#cancelButton');

const advancedOptionsToggle = document.querySelector('#advancedOptionsToggle');

advancedOptionsToggle.addEventListener('click', () => {
  // Change Emoji, from ▼ to ▲ and vice versa
  const emoji = advancedOptionsToggle.textContent;
  advancedOptionsToggle.textContent = emoji.includes('▼') ? 'Show less Options ▲' : 'Show Advanced Options ▼';
  const advancedOptions = document.querySelector('#advancedOptions');
  advancedOptions.classList.toggle('hidden');
});
