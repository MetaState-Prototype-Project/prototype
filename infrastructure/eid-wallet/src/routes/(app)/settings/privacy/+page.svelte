<script lang="ts">
import { runtime } from "$lib/global/runtime.svelte";

$effect(() => {
    runtime.header.title = "Privacy";
});
</script>

<main
    class="h-full pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <h4>Last modified 19th March 2025</h4>
    <p class="text-black-700">
        Welcome to eID Wallet! Your privacy is important to us. This Privacy
        Policy explains how we collect, use, disclose, and protect your personal
        information when you use our mobile application.
    </p>
    <br />
    <h4>1. Information We Collect</h4>
    <p class="text-black-700">
        We collect the following types of information to provide and improve our
        services:
    </p>
    <ol type="a">
        <li>
            <strong>Personal Identification Data</strong>
            <ul>
                <li>Full name, date of birth, government-issued ID details</li>
                <li>Phone number, email address (if used for recovery)</li>
            </ul>
        </li>
        <li>
            <strong>Biometric Data (Optional)</strong>
            <ul>
                <li>
                    Fingerprint, facial recognition (only stored on your device
                    for authentication purposes)
                </li>
            </ul>
        </li>
        <li>
            <strong>Device & Usage Information</strong>
            <ul>
                <li>Device type, operating system, and app usage data</li>
                <li>IP address and session activity</li>
            </ul>
        </li>
    </ol>
</main>
