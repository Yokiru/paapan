// English Translations
import { Translations } from './id';

export const en: Translations = {
    // === COMMON ===
    common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        confirm: 'Confirm',
        loading: 'Loading...',
        search: 'Search',
        back: 'Back',
        next: 'Next',
        done: 'Done',
        or: 'Or',
        yes: 'Yes',
        no: 'No',
        saving: 'Saving...',
    },

    // === AUTH ===
    auth: {
        login: 'Sign In',
        register: 'Sign Up',
        logout: 'Sign Out',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        fullName: 'Full Name',
        forgotPassword: 'Forgot password?',
        resetPassword: 'Reset Password',
        sendResetLink: 'Send Reset Link',
        newPassword: 'New Password',
        confirmNewPassword: 'Confirm New Password',
        // Titles
        welcomeBack: 'Welcome Back',
        createAccount: 'Create Account',
        forgotPasswordTitle: 'Forgot Password',
        resetPasswordTitle: 'Reset Password',
        // Subtitles
        loginSubtitle: 'Sign in to your creative workspace',
        registerSubtitle: 'Start your creative journey',
        forgotSubtitle: 'Enter your email to receive a reset link',
        resetSubtitle: 'Create a new password for your account',
        // Footer
        noAccount: "Don't have an account?",
        hasAccount: 'Already have an account?',
        // Social
        continueWithGoogle: 'Continue with Google',
        continueWithApple: 'Continue with Apple',
        // Success
        resetLinkSent: 'Reset link has been sent to your email',
        checkEmail: 'Check your email',
        passwordUpdated: 'Password successfully updated',
        backToLogin: 'Back to Sign In',
        resetSent: 'We\'ve sent a password reset link to your email',
        checkSpam: 'Didn\'t receive the email? Check your spam folder or',
        tryAnotherEmail: 'Try another email',
    },

    // === SIDEBAR ===
    sidebar: {
        newBoard: 'New Board',
        searchBoards: 'Search boards...',
        favorites: 'Favorites',
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        older: 'Older',
        noBoards: 'No boards yet',
        startCreating: 'Start creating your first board',
        deleteConfirm: 'Delete this board?',
        deleteWarning: 'This action cannot be undone',
        addToFavorites: 'Add to Favorites',
        removeFromFavorites: 'Remove from Favorites',
        appName: 'Boardku',
    },

    // === PROFILE MENU ===
    profileMenu: {
        profile: 'Profile',
        aiSettings: 'AI Settings',
        subscription: 'Subscription',
        settings: 'Settings',
        feedback: 'Feedback',
        help: 'Help',
        signOut: 'Sign Out',
        freePlan: 'Free Plan',
        plusPlan: 'Plus Plan',
        proPlan: 'Pro Plan',
        userName: 'User',
    },

    // === PROFILE MODAL ===
    profileModal: {
        title: 'Profile Settings',
        subtitle: 'Manage your account information',
        photoLabel: 'Profile Photo',
        uploadHint: 'Click to upload new photo',
        fullName: 'Full Name',
        namePlaceholder: 'Enter your name',
        email: 'Email Address',
        emailHint: 'Email cannot be changed',
        changeAvatar: 'Change Profile Photo',
        displayName: 'Display Name',
        emailAddress: 'Email Address',
        emailNote: 'Email cannot be changed',
    },

    // === SETTINGS MODAL ===
    settingsModal: {
        title: 'Settings',
        subtitle: 'Manage your account settings',
        changePassword: 'Change Password',
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm Password',
        updatePassword: 'Update Password',
        updatingPassword: 'Updating...',
        language: 'Language',
        displayLanguage: 'Display Language',
        selectLanguage: 'Choose your preferred language',
        about: 'About',
        terms: 'Terms of Service',
        privacy: 'Privacy Policy',
        view: 'View',
        developer: 'Developer',
        website: 'Website',
        dangerZone: 'Danger Zone',
        deleteAccount: 'Delete Account',
        deleteAccountConfirm: 'Once you delete your account, there is no going back. Please be certain.',
        deleteAccountWarning: 'This will permanently delete all data',
        yesDelete: 'Yes, Delete My Account',
        accountDeleted: 'Account deleted!',
    },

    // === AI SETTINGS MODAL ===
    aiSettingsModal: {
        title: 'AI Personalization',
        subtitle: 'Customize how AI responds to you',
        responseStyle: 'Response Style',
        responseStyleDesc: 'Choose how AI communicates with you',
        concise: 'Concise',
        conciseDesc: 'Short & direct',
        balanced: 'Balanced',
        balancedDesc: 'Best balance',
        detailed: 'Detailed',
        detailedDesc: 'Complete explanation',
        friendly: 'Friendly',
        professional: 'Professional',
        friendlyDesc: 'Casual & warm',
        professionalDesc: 'Formal & structured',
        responseLanguage: 'Response Language',
        responseLanguageDesc: 'AI will respond in this language',
        indonesian: 'Indonesian',
        english: 'English',
        yourName: 'Your Name',
        yourNameDesc: 'AI will address you by this name',
        yourNamePlaceholder: 'What should AI call you?',
        customInstructions: 'Custom Instructions',
        customInstructionsDesc: 'Additional preferences AI should keep in mind',
        customInstructionsPlaceholder: 'E.g., Focus on web development, explain things simply...',
        savePreferences: 'Save Preferences',
    },

    // === SUBSCRIPTION MODAL ===
    subscriptionModal: {
        title: 'Upgrade Your Workspace',
        subtitle: 'Unlock the full power of Spatial AI. Choose the plan that fits your workflow.',
        currentPlan: 'Current Plan',
        upgradeTo: 'Upgrade to',
        perMonth: '/mo',
        bestValue: 'Best Value',
        // Tier Names
        free: 'Free',
        plus: 'Plus',
        pro: 'Pro',
        // Tier Descriptions
        freeDesc: 'Perfect for getting started',
        plusDesc: 'Best for regular users',
        proDesc: 'For power users & creators',
        // Features
        aiChatsPerDay: 'AI Chats / day',
        imageAnalysesPerDay: 'Image Analyses / day',
        boardsLimit: 'Boards Limit',
        unlimited: 'Unlimited',
        standardSupport: 'Standard Support',
        prioritySupport: 'Priority Support',
        dedicatedSupport: 'Dedicated Support',
        noAds: 'No Ads',
        earlyAccess: 'Early Access Features',
        // Payment
        paymentMethods: 'Accepting local Indonesia payments',
        securedBy: 'Secured by',
        cancelAnytime: 'Cancel anytime from settings',
        termsApply: 'Terms of Service & Privacy Policy apply.',
        gemini2Flash: 'Gemini 2.0 Flash Model',
        gemini25Flash: 'Gemini 2.5 Flash Model',
    },

    // === CANVAS / TOOLBAR ===
    canvas: {
        newTopic: 'New Topic',
        addText: 'Add Text',
        addImage: 'Add Image',
        askAI: 'Ask AI',
        addAIChat: 'Start AI Chat',
        select: 'Select',
        hand: 'Hand',
        pen: 'Pen',
        eraser: 'Eraser',
    },

    // === HANDLE MENU ===
    handleMenu: {
        askFollowUp: 'Ask a follow-up',
        disconnect: 'Disconnect',
        edgeTo: 'Edge to',
    },

    // === AI INPUT ===
    aiInput: {
        placeholder: 'Ask anything...',
        analyzing: 'Analyzing...',
        generating: 'Generating response...',
    },

    // === NODE ACTIONS ===
    nodeActions: {
        addChild: 'Add Child',
        askAI: 'Ask AI',
        delete: 'Delete',
        editContent: 'Edit Content',
        changeColor: 'Change Color',
        summarize: 'Summarize',
        expand: 'Expand',
        translate: 'Translate',
        copy: 'Copy Response',
        regenerate: 'Regenerate',
        duplicate: 'Duplicate',
        addTag: '+ Tag',
        newTagPlaceholder: 'New tag...',
        bubblePlaceholder: "What's on your mind?",
        doubleClickPlaceholder: 'Double-click to type...',
        expandBranch: 'Expand branch',
        collapseBranch: 'Collapse branch',
        removeFavorite: 'Remove from favorites',
        addToFavorite: 'Add to favorites',
    },

    // === TEXT NODE ===
    textNode: {
        bold: 'Bold',
        alignLeft: 'Align Left',
        alignCenter: 'Align Center',
        alignRight: 'Align Right',
        toggleBackground: 'Toggle Background',
        placeholder: 'Type your text...',
        doubleClickEdit: 'Double-click to edit...',
    },

    // === MAIN PAGE ===
    mainPage: {
        openSidebar: 'Open sidebar',
        loadingBoard: 'Loading board...',
    },

    // === PEN SETTINGS ===
    penSettings: {
        strokeWidth: 'Stroke Width',
        clearAll: 'Clear All',
        clearAllConfirm: 'Clear all drawings?',
        clearAllWarning: 'This action cannot be undone',
    },

    // === ERRORS ===
    errors: {
        somethingWentWrong: 'Something went wrong',
        tryAgain: 'Try again',
        networkError: 'Network error',
        invalidEmail: 'Invalid email',
        passwordMismatch: 'Passwords do not match',
        passwordTooShort: 'Password must be at least 8 characters',
    },
};
