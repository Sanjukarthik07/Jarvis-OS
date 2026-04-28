# J.A.R.V.I.S. Mobile-OS Prime (v6.0)

Welcome, Sir. This is the official documentation for your custom intelligence architecture. 

Because this local machine runs on Windows, it lacks the hardware (macOS) and configured compilers (Java JDK) to natively generate iOS `.ipa` and Android `.apk` binaries. 

To bypass this limitation, you must deploy this repository to a **Cloud Compiler**. Follow the protocols below precisely.

---

## Phase 1: Uploading the Core to GitHub

We must first transfer this localized codebase to a secure server. 

1. Go to [GitHub](https://github.com/) and log in to your account.
2. Click the **+** icon in the top right and select **New repository**.
3. Name it `Jarvis-OS` (leave it Public or Private, do not add a README or .gitignore from the Github menu).
4. Copy the URL of your new repository (e.g., `https://github.com/YourUsername/Jarvis-OS.git`).
5. Open your terminal (Command Prompt or PowerShell) inside this folder: `c:\Users\Surface\OneDrive\Desktop\Jarvis`.
6. Run the following commands in sequence to upload the data:
   ```bash
   git remote add origin YOUR_GITHUB_REPO_URL
   git branch -M main
   git push -u origin main
   ```

*The core is now safely stored in the grid.*

---

## Phase 2: Compiling the `.apk` and `.ipa` (Cloud Compilation)

We will use **Ionic Appflow** (or Codemagic) to act as our surrogate Mac and Android Studio.

### Option A: Using Ionic Appflow (Recommended)
1. Navigate to [Ionic Appflow](https://ionicframework.com/appflow) and create a free account.
2. In the dashboard, click **Apps** -> **New App**.
3. Click **Import App** and connect your GitHub account.
4. Select the `Jarvis-OS` repository you just created.
5. Once connected, navigate to the **Builds** tab.
6. Click **New Build**:
   *   **For Android (.apk):** Select the target `Android`, choose the latest build stack, and select `Debug` or `APK` as the output.
   *   **For iOS (.ipa):** Select the target `iOS`, choose `Development` build. *(Note: Apple requires a Developer Certificate to install an .ipa. Appflow can generate the unsigned archive, but you will eventually need a free Apple Developer account to sign it).*
7. Click **Build**. The cloud servers will spool up a Mac/Linux machine, compile your app, and provide a direct download link.

### Option B: Using Codemagic
1. Go to [Codemagic](https://codemagic.io/) and sign up.
2. Click **Add Application** and select GitHub.
3. Select your `Jarvis-OS` repository.
4. Codemagic will automatically detect that this is a Capacitor/React app.
5. In the Build settings, check the boxes for **Android** and **iOS**.
6. Click **Start your first build**. Once complete, download your binaries.

---

## Quantum Matrix Configuration (API Key)

Once you install the app on your mobile device, the "Quantum Matrix" (LLM Intelligence) will be offline until authenticated.

1. Open the JARVIS app.
2. Tap the **CONFIG** button in the top right corner.
3. Paste your [Google Gemini API Key](https://aistudio.google.com/).
4. (Optional) Check the **Enable Wake Engine** box for continuous microphone listening.
5. Click **SAVE**. 

The system is now fully operational, Sir.
