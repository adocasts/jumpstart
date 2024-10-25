![Adocasts](https://github.com/adocasts/.github/blob/main/assets/brand-banner-rounded.png?raw=true)

<h1 align="center">
  Adocasts Jumpstart
</h1>
<p align="center">
  An AdonisJS 6 Authentication Scaffold with TailwindCSS
  <br/>
  <code>node ace add @adocasts.com/jumpstart</code>
</p>

<hr />

[![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

## Features
Everything you meed to jumpstart your next AdonisJS 6 project
- 🪄 Automatically configures TailwindCSS
- 🔐 Full authentication flow, including remember me
- 🔏 Forgot password ready to go out-of-the-box, including email
- 🕵️ Simple profile settings page
- 👨‍💻 Simple account settings page with change email & delete account forms
- 🚨 Toast messages to notify your users
- 🏖️ Handy EdgeJS components and layouts to get you going

## Works With
It is recommended to start from the **Web Starter Kit** as it comes out-of-the-box with most of the AdonisJS core packages we require.
- 🕸️ Web Starter Kit *(recommended)*
- 📏 Slim Starter Kit

## Requires
We require the following AdonisJS core packages. If you're missing any, we'll walk you through adding any you're missing.
- [Vite](https://docs.adonisjs.com/guides/basics/vite) (`@adonisjs/vite`)
- [VineJS](https://docs.adonisjs.com/guides/basics/validation) (`vine`)
- [EdgeJS](https://docs.adonisjs.com/guides/views-and-templates/edgejs) (`edge`)
- [Session](https://docs.adonisjs.com/guides/basics/session) (`@adonisjs/session`)
- [Shield](https://docs.adonisjs.com/guides/security/securing-ssr-applications) (`@adonisjs/shield`)
- [Auth (Session Guard)](https://docs.adonisjs.com/guides/authentication/introduction) (`@adonisjs/auth`)
- [Lucid](https://docs.adonisjs.com/guides/database/lucid) (`@adonisjs/lucid`)
- [Mail](https://docs.adonisjs.com/guides/digging-deeper/mail) (`@adonisjs/mail`)

## Getting Started
Adocasts Jumpstart only needs to run once and adds/installs everything needed directly into your project so you have full control to change anything you wish.
```shell
node ace add @adocasts.com/jumpstart
```
All you need to do is install & configure Adocasts Jumpstart. It'll then:
1. Walk you through adding any missing AdonisJS core packages
2. Install the following dependencies directly into your project. Feel free to remove any you don't wish to use
   - TailwindCSS (`tailwindcss --dev`)
   - Autoprefixer (`autoprefixer --dev`)
   - EdgeJS Iconify (`edge-iconify`)
   - Iconify Phosphor (`@iconify-json/ph`)
   - Iconify SVG Spinners (`@iconify-json/svg-spinners`)
3. Fully configure TailwindCSS inside your project
4. Adds an `APP_URL` environment variable (useful for email link generating)
5. Enables HTTP Method Spoofing (allows REST-based routes)
6. Adds a globals preload file for EdgeJS globals & to configure EdgeJS Iconify
7. Adds all stub files into your project. This will include:
   - Controllers
   - Models
   - Services
   - Validators
   - Migrations
   - Views -> Components
   - Views -> Emails
   - Views -> Pages
8. Adds Jumpstart's routes to your `routes.ts` file
9. Adds auth methods to your user model

After that, be sure to update any new environment variables or configurations that may have been added from missing AdonisJS core packages, boot it up, and visit `/jumpstart`.

[npm-image]: https://img.shields.io/npm/v/@adocasts.com/jumpstart/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@adocasts.com/jumpstart/v/latest 'npm'
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[license-url]: LICENSE.md
[license-image]: https://img.shields.io/github/license/adocasts/generate-models?style=for-the-badge
