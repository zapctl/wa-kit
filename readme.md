# **wa-kitchen**

[![update checker](https://img.shields.io/github/actions/workflow/status/zapctl/wa-kitchen/update.yml?label=Auto%20update%20checker)](https://github.com/zapctl/wa-kitchen/actions/workflows/update.yml)
[![publish](https://img.shields.io/github/actions/workflow/status/zapctl/wa-kitchen/publish.yml?label=Publish)](https://github.com/zapctl/wa-kitchen/actions/workflows/publish.yml)
[![license](https://img.shields.io/github/license/zapctl/wa-kitchen.svg?label=License)](https://github.com/zapctl/wa-kitchen/blob/main/LICENSE)
[![github stars](https://img.shields.io/github/stars/zapctl/wa-kitchen.svg?label=stars)](https://github.com/zapctl/wa-kitchen)

**wa-kitchen** is a workspace that tracks WhatsApp Web updates, extracts internal definitions, and produces language-friendly packages for unofficial WhatsApp integrations and automation tooling.

It acts as a *build pipeline* that continuously watches WhatsApp Web, parses its artifacts, and “cooks” them into structured, versioned modules you can consume safely.

---

## 🔥 Features

* **Monitors WhatsApp Web bundle changes**
  Automatically detects new deployments and diffs internal artifacts.

* **Extracts multi-format definitions**

  * Protobuf schemas
  * GraphQL types
  * Constants
  * URLs
  * Regex patterns
  * Low-level config objects
  * Internal metadata

* **Generates reusable packages**
  Outputs clean language-agnostic artifacts and publishes package bindings (ex: NPM).

* **Version-locked artifacts**
  Ensures consistency across updates to avoid breaking downstream projects.

---

## 📦 Packages

#### **Node.js:** [https://www.npmjs.com/package/wa-kitchen](https://www.npmjs.com/package/wa-kitchen)

More languages and targets will be added as the extraction pipeline evolves.

---

## 🧑‍💻 Contributing

Contributions are welcome!
If you encounter an issue, want to improve extraction accuracy, or want support for a new language/format, feel free to open an issue or PR:

➡️ **GitHub:** [https://github.com/zapctl/wa-kitchen](https://github.com/zapctl/wa-kitchen)

Please follow structured commit messages and keep changes atomic when modifying extraction logic.

---

## ⚖️ Legal Notice

This project is **unofficial** and **not affiliated with WhatsApp, Meta, or Facebook**.
The extracted definitions are provided solely for **research, interoperability, and development**.
Users are responsible for complying with WhatsApp’s Terms of Service when building automations or tools powered by this data.