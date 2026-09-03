// A searchable select with one focusable input, keyboard navigation, and a full
// scrollable option list. Multi-select is used for acceptable negative traits.
let serial = 0;
let openCombo = null;

export class SearchCombo {
  constructor(root, {label, placeholder, options, selected, onChange, multiple = false, footer}) {
    Object.assign(this, {root, label, placeholder, options, selected, onChange, multiple, footer});
    this.id = `riven-list-${++serial}`;
    this.trigger = root.querySelector('.combo-trigger');
    this.trigger.addEventListener('click', () => this.open());
    this.trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); this.open(); }
    });
    root.addEventListener('focusout', event => {
      if (this.input && event.relatedTarget && !root.contains(event.relatedTarget)) this.close(false);
    });
  }

  update(text, disabled = false) {
    this.trigger.querySelector('span').textContent = text;
    this.trigger.title = text;
    this.trigger.disabled = disabled;
    if (this.input) this.renderOptions();
  }

  open() {
    if (this.input || this.trigger.disabled) return;
    if (openCombo) openCombo.close(false);
    openCombo = this;
    this.root.classList.add('is-open');
    this.trigger.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.input = document.createElement('input');
    Object.assign(this.input, {className: 'combo-input', type: 'text', autocomplete: 'off', spellcheck: false, placeholder: this.placeholder});
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-label', this.label);
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-expanded', 'true');
    this.input.setAttribute('aria-controls', this.id);
    this.menu = document.createElement('div');
    this.menu.className = 'combo-menu';
    this.list = document.createElement('div');
    this.list.className = 'combo-list';
    this.list.id = this.id;
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', this.label);
    if (this.multiple) this.list.setAttribute('aria-multiselectable', 'true');
    this.menu.append(this.list);
    if (this.multiple) {
      const bottom = document.createElement('div');
      bottom.className = 'combo-menu-footer';
      this.footerText = document.createElement('span');
      const done = document.createElement('button');
      Object.assign(done, {type: 'button', className: 'combo-done', textContent: 'Done'});
      done.addEventListener('click', () => this.close(true));
      bottom.append(this.footerText, done);
      this.menu.append(bottom);
    }
    this.root.append(this.input, this.menu);
    this.input.addEventListener('input', () => this.renderOptions());
    this.input.addEventListener('keydown', event => this.keydown(event));
    this.renderOptions();
    this.input.focus();
  }

  renderOptions() {
    if (!this.input) return;
    const query = this.input.value.trim().toLocaleLowerCase();
    this.filtered = this.options().filter(option => !query || `${option.label} ${option.search || ''} ${option.description || ''}`.toLocaleLowerCase().includes(query));
    this.list.replaceChildren();
    this.buttons = [];
    const selected = this.selected();
    this.filtered.forEach((option, index) => {
      const item = document.createElement('button');
      Object.assign(item, {type: 'button', className: 'combo-option', tabIndex: -1, id: `${this.id}-${index}`});
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(Array.isArray(selected) ? selected.includes(option.value) : selected === option.value));
      if (option.disabled) item.setAttribute('aria-disabled', 'true');
      if (option.uncertain) item.classList.add('unverified');
      if (option.vintage) item.classList.add('vintage');
      const label = document.createElement('span');
      label.className = 'combo-option-label';
      label.textContent = option.label;
      if (option.description) {
        const detail = document.createElement('span');
        detail.className = 'option-description';
        detail.textContent = option.description;
        label.append(detail);
      }
      item.append(label);
      if (this.multiple && !option.action) {
        const check = document.createElement('span');
        check.className = 'option-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = Array.isArray(selected) && selected.includes(option.value) ? '✓' : '';
        item.append(check);
      }
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('click', () => this.pick(index));
      this.buttons.push(item);
      this.list.append(item);
    });
    if (!this.filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = 'No matching options';
      this.list.append(empty);
    }
    if (this.footerText) this.footerText.textContent = this.footer?.() || 'Choose any acceptable alternatives';
    this.highlight = this.filtered.findIndex(option => !option.disabled);
    this.setHighlight(this.highlight, false);
  }

  setHighlight(index, scroll = true) {
    this.highlight = index;
    this.buttons.forEach((button, i) => button.classList.toggle('is-highlighted', i === index));
    if (index >= 0) {
      this.input.setAttribute('aria-activedescendant', this.buttons[index].id);
      if (scroll) this.buttons[index].scrollIntoView({block: 'nearest'});
    } else this.input.removeAttribute('aria-activedescendant');
  }

  keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(true); }
    else if (event.key === 'Tab') this.close(true);
    else if (event.key === 'Enter') { event.preventDefault(); this.pick(this.highlight); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const enabled = this.filtered.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
      if (!enabled.length) return;
      const current = enabled.indexOf(this.highlight);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
      this.setHighlight(enabled[next]);
    }
  }

  pick(index) {
    const option = this.filtered[index];
    if (!option || option.disabled) return;
    if (!this.multiple) this.close(true);
    this.onChange(option.value);
    if (this.multiple && this.input) {
      this.renderOptions();
      this.input.focus();
    }
  }

  close(refocus = false) {
    if (!this.input) return;
    this.input.remove();
    this.menu.remove();
    this.input = this.menu = this.footerText = null;
    this.trigger.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.root.classList.remove('is-open');
    if (openCombo === this) openCombo = null;
    if (refocus) this.trigger.focus();
  }
}

document.addEventListener('pointerdown', event => {
  if (openCombo && !openCombo.root.contains(event.target)) openCombo.close(false);
});
