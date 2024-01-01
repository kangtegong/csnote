let currentLanguage = 'ko';
let translations = {};
let currentYamlFile = '';

async function setLanguage(lang) {
  currentLanguage = lang;
  const response = await fetch(`config/lang/${lang}.json`);
  translations = await response.json();
  translatePage();
  loadReadme(); // Load README file based on the selected language
  if (currentYamlFile) {
    loadYaml(currentYamlFile); // Reload YAML file based on the selected language
  }
}

function translatePage() {
  document.getElementById('homeLink').textContent = translations.home;
  document.getElementById('subjectsLink').textContent = translations.subjects;
  document.getElementById('referenceFilterLink').textContent = translations.referenceFilter;
  document.getElementById('searchInput').placeholder = translations.searchPlaceholder;
  document.getElementById('lastModified').textContent = translations.lastModified;
  buildDropdown(); // Rebuild the dropdown with translations
  buildReferenceDropdown(); // Rebuild the reference dropdown with translations
}

function showSearch() {
  document.getElementById('searchInput').style.display = 'block';
}

function hideSearch() {
  document.getElementById('searchInput').style.display = 'none';
}

function showReferenceFilter() {
  document.getElementById('referenceFilter').style.display = 'block';
}

function hideReferenceFilter() {
  document.getElementById('referenceFilter').style.display = 'none';
}

function hideLanguageSelect() {
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.style.display = 'none';
  }
}

function showLanguageSelect() {
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.style.display = 'block';
  }
}

function resetPage() {
  showLanguageSelect();
  hideReferenceFilter();
  hideSearch();
  loadReadme();
  currentYamlFile = '';
  history.pushState(null, '', '/');
}

let subjects = [];
let referenceTypes = new Set();

async function loadConfig() {
  const response = await fetch('config/config.json');
  const config = await response.json();
  subjects = config.subjects;
  buildDropdown();
  countTerms();
  displayVersion(config.version);
}

function displayVersion(version) {
  const footer = document.querySelector('footer');
  const versionInfo = document.createElement('span');
  versionInfo.textContent = `| Version ${version}`;
  footer.appendChild(versionInfo);
}

function buildDropdown() {
  const dropdown = document.querySelector('.dropdown-content');
  dropdown.innerHTML = ''; // 드롭다운 내용을 초기화

  subjects.forEach(subject => {
    const subjectName = currentLanguage === 'en' ? subject.name_en : subject.name_ko;
    const link = document.createElement('a');
    link.href = `#${subject.file.split('.')[0]}`;
    link.textContent = subjectName;
    link.onclick = function(event) {
      event.preventDefault();
      currentYamlFile = subject.file.split('.')[0] + (currentLanguage === 'en' ? '-en.yaml' : '.yaml');
      loadYaml(currentYamlFile);
      showSearch();
      showReferenceFilter();
      hideLanguageSelect();
      return false;
    };
    dropdown.appendChild(link);
  });
}

function buildReferenceDropdown() {
  const dropdown = document.getElementById('referenceDropdown');
  dropdown.innerHTML = ''; // 드롭다운 내용을 초기화

  console.log('Building reference dropdown with types:', referenceTypes);
  if (referenceTypes.size === 0) {
      const noReferenceLabel = document.createElement('span');
      noReferenceLabel.textContent = translations.noReferences || "No references available";
      dropdown.appendChild(noReferenceLabel);
  } else {
      referenceTypes.forEach(type => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = type;
          checkbox.checked = false; // 기본적으로 체크되지 않도록 설정
          checkbox.onchange = toggleReferencesVisibility;
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(type));
          dropdown.appendChild(label);
          dropdown.appendChild(document.createElement('br'));
      });
  }
}

function toggleReferencesVisibility() {
  const checkboxes = document.querySelectorAll('#referenceDropdown input[type="checkbox"]');
  const tables = document.querySelectorAll('table');

  tables.forEach(table => {
      Array.from(table.getElementsByTagName('tr')).forEach(row => {
          const references = row.getAttribute('data-references') ? row.getAttribute('data-references').split(';') : [];
          const descCell = row.getElementsByTagName('td')[0];

          descCell.querySelectorAll('.reference-span').forEach(span => span.style.display = 'none'); // 기본적으로 숨김

          references.forEach(reference => {
              const [type] = reference.split('/');
              const isVisible = Array.from(checkboxes).some(checkbox => checkbox.checked && checkbox.value === type);
              if (isVisible) {
                  descCell.querySelector(`.reference-span-${type}`).style.display = 'inline';
              }
          });
      });
  });
}

function searchTerms() {
  filterTerms();
}

function filterTerms() {
  const checkboxes = document.querySelectorAll('#referenceDropdown input[type="checkbox"]');
  const selectedTypes = Array.from(checkboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value);
  const searchValue = document.getElementById('searchInput').value.toLowerCase();

  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
      let tableVisible = false;

      Array.from(table.getElementsByTagName('tr')).forEach(row => {
          const term = row.getElementsByTagName('th')[0].textContent.toLowerCase();
          const descCell = row.getElementsByTagName('td')[0];
          const references = row.getAttribute('data-references') ? row.getAttribute('data-references').split(';') : [];
          const subtypeSpans = descCell.querySelectorAll('.subtype-span');

          let shouldDisplay = false;

          if (selectedTypes.length === 0) {
              shouldDisplay = term.includes(searchValue);
          } else {
              references.forEach(reference => {
                  const [type, subtype] = reference.split('/');
                  if (selectedTypes.includes(type) && term.includes(searchValue)) {
                      shouldDisplay = true;
                      if (!descCell.querySelector(`.subtype-span-${type}`)) {
                          const newSubtypeSpan = document.createElement('span');
                          newSubtypeSpan.classList.add('subtype-span', `subtype-span-${type}`);
                          newSubtypeSpan.style.fontWeight = 'bold';
                          newSubtypeSpan.textContent = ` (${subtype})`;
                          descCell.appendChild(newSubtypeSpan);
                      }
                  }
              });
          }

          row.style.display = shouldDisplay ? '' : 'none';
          if (shouldDisplay) {
              tableVisible = true;
          }

          if (!shouldDisplay) {
              subtypeSpans.forEach(span => span.remove());
          }
      });

      table.style.display = tableVisible ? '' : 'none';
  });

  // 부모 요소들 (title, subtitle, subsubtitle)을 검사하고, 검색 결과가 없는 경우 숨김
  const sections = document.querySelectorAll('h1, h2, h3');
  sections.forEach(section => {
      const nextElement = section.nextElementSibling;
      if (nextElement && nextElement.tagName === 'TABLE') {
          section.style.display = nextElement.style.display;
      } else {
          section.style.display = 'none';
      }
  });
}

function loadYaml(yamlFile) {
  const container = document.getElementById('content');
  container.innerHTML = ''; // Clear previous content

  fetch(`subjects/${yamlFile}`)
    .then(response => response.text())
    .then(yaml => {
        const data = jsyaml.load(yaml);
        referenceTypes.clear(); // Clear previous reference types
        data.sections.forEach((section, index) => {
            const sectionId = `section${index + 1}`;
            const h1 = document.createElement('h1');
            h1.id = sectionId;
            h1.textContent = section.title;
            container.appendChild(h1);

            section.content.forEach(subsection => {
                const h2 = document.createElement('h2');
                h2.textContent = subsection.subtitle;
                container.appendChild(h2);

                if (subsection.items) {
                    appendTable(container, subsection.items);
                }

                if (subsection.content) {
                    appendContent(container, subsection.content);
                }
            });
        });
        console.log('Reference types after loading YAML:', referenceTypes);
        buildReferenceDropdown(); // Rebuild reference dropdown after loading YAML
    })
    .catch(error => {
        console.error('Error loading the YAML file:', error);
        container.innerHTML = '<p>yaml 파일 로드 실패</p>';
    });
}

function appendContent(container, content) {
  content.forEach(subsubsection => {
    const h3 = document.createElement('h3');
    h3.textContent = subsubsection.subsubtitle;
    container.appendChild(h3);

    if (subsubsection.items) {
      appendTable(container, subsubsection.items);
    }

    if (subsubsection.content) {
      appendContent(container, subsubsection.content);
    }
  });
}

function appendTable(container, items) {
  const table = document.createElement('table');
  items.forEach(item => {
      const row = document.createElement('tr');
      if (item.references) {
          row.setAttribute('data-references', item.references.join(';'));
          item.references.forEach(reference => {
              const [type] = reference.split('/');
              referenceTypes.add(type);
              console.log('Adding reference type:', type, 'from references:', reference);
          });
      } else if (item.reference) {
          row.setAttribute('data-references', item.reference);
          const [type] = item.reference.split('/');
          referenceTypes.add(type);
          console.log('Adding reference type:', type, 'from reference:', item.reference);
      }

      const termCell = document.createElement('th');
      termCell.textContent = item.term;
      if (item.superscript) {
          const sup = document.createElement('sup');
          sup.textContent = item.superscript;
          termCell.appendChild(sup);
      }
      const descCell = document.createElement('td');

      if (item.image) {
          const img = document.createElement('img');
          img.src = item.image;
          img.alt = item.alt || '';
          descCell.appendChild(img);
          descCell.appendChild(document.createElement('br'));
      }

      const description = document.createElement('span');
      description.innerHTML = item.description;
      descCell.appendChild(description);

      if (item.references) {
          item.references.forEach(reference => {
              const [type, subtype] = reference.split('/');
              const referenceSpan = document.createElement('span');
              referenceSpan.classList.add('reference-span', `reference-span-${type}`);
              referenceSpan.style.display = 'none'; // 기본적으로 숨김
              referenceSpan.style.fontWeight = 'bold';
              referenceSpan.textContent = ` (${subtype})`;
              descCell.appendChild(referenceSpan);
          });
      }

      row.appendChild(termCell);
      row.appendChild(descCell);
      table.appendChild(row);
  });
  container.appendChild(table);
}

let totalTerms = 0;

async function countTerms() {
  for (const file of subjects.map(sub => `subjects/${sub.file}`)) {
    const localizedFile = file.replace('.yaml', currentLanguage === 'en' ? '-en.yaml' : '.yaml');
    await fetch(localizedFile)
      .then(response => response.text())
      .then(yaml => {
        const data = jsyaml.load(yaml);
        data.sections.forEach(section => {
          section.content.forEach(subsection => {
            if (subsection.items) {
              totalTerms += subsection.items.length;
            }
            if (subsection.content) {
              subsection.content.forEach(subsub => {
                if (subsub.items) {
                  totalTerms += subsub.items.length;
                }
              });
            }
          });
        });
      })
      .catch(error => console.error('Error loading YAML file:', error));
  }
  displayTotalTerms();
}

function displayTotalTerms() {
  const totalTermsBadge = document.createElement('h4');
  totalTermsBadge.textContent = `등록된 CS 용어 수: ${totalTerms}`;

  const logoImage = document.querySelector('img[src*="assets/img/logo"]');

  if (logoImage) {
    logoImage.parentNode.insertBefore(totalTermsBadge, logoImage.nextSibling);   
    logoImage.insertAdjacentHTML('afterend', '<br>');
  } else {
    console.error("Logo image not found.");
  }
}

async function fetchLastModified() {
  try {
    const response = await fetch('https://api.github.com/repos/kangtegong/csnote/commits?per_page=1');
    if (!response.ok) {
      throw new Error('GitHub API call failed');
    }
    const data = await response.json();
    if (data.length > 0) {
      const lastCommitDate = new Date(data[0].commit.committer.date);
      document.getElementById('lastModified').textContent = `Last modified: ${lastCommitDate.toLocaleDateString()} at ${lastCommitDate.toLocaleTimeString()}`;
      document.getElementById('lastModified').dataset.sha = data[0].sha;
    } else {
      document.getElementById('lastModified').textContent = 'No modification data available';
    }
  } catch (error) {
    console.error('Error fetching last modified data:', error);
    document.getElementById('lastModified').textContent = 'Failed to load modification data';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  fetchLastModified();
  const hash = window.location.hash.substring(1);
  if (hash) {
    const subject = subjects.find(sub => sub.file.split('.')[0] === hash);
    if (subject) {
      currentYamlFile = subject.file.split('.')[0] + (currentLanguage === 'en' ? '-en.yaml' : '.yaml');
      loadYaml(currentYamlFile);
      showSearch();
      showReferenceFilter();
      hideLanguageSelect();
    }
  }
});

async function showDiff() {
  const sha = document.getElementById('lastModified').dataset.sha;
  const url = `https://github.com/kangtegong/csnote/commit/${sha}`;
  window.open(url, '_blank').focus();
}

loadConfig();

async function loadReadme() {
  const readmeFile = currentLanguage === 'en' ? './README-en.md' : './README.md';
  const response = await fetch(readmeFile);
  const text = await response.text();
  document.getElementById('content').innerHTML = marked.parse(text);
}

document.addEventListener('DOMContentLoaded', loadReadme);
setLanguage('ko');
