<script lang="ts">
import { SettingsNavigationBtn } from "$lib/fragments";
import {
	Key01Icon,
	LanguageSquareIcon,
	Link02Icon,
	PinCodeIcon,
	Shield01Icon,
} from "@hugeicons/core-free-icons";
</script>

<main class="pt-[3vh] px-[5vw] pb-[4.5vh]">
    <!-- header part -->
    <SettingsNavigationBtn icon={LanguageSquareIcon} label="Language" href="/settings/language"/>
    <SettingsNavigationBtn icon={Link02Icon} label="History" href="/settings/history"/>
    <SettingsNavigationBtn icon={PinCodeIcon} label="Pin" href="/settings/pin"/>
    <SettingsNavigationBtn icon={Key01Icon} label="Keys" href="/settings/keys"/>
    <SettingsNavigationBtn icon={Shield01Icon} label="Privacy" href="/settings/privacy"/>
</main>