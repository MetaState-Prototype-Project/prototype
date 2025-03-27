<script lang="ts">
import { ButtonAction } from "$lib/ui";

let usedStorage = $state(50);
let totalStorage = $state(90);

const handleFinish = async () => {};
</script>


<main class="h-[100vh] pt-[5.2vh] px-[2.3vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h3 class="mb-[0.5vh]">Your ePassport and eVault are ready</h3>
        <p class="text-black-700! mb-[3vh]">Log into any W3DS platform without passwords. It’s tied to this phone; if lost, you’ll need to revoke and reissue it on a new device.</p>
    </section>
    <section>
        <h3 class="mb-[0.5vh]">Your eVault</h3>
        <p class="text-black-700! mb-[3vh]">We’ve also created your eVault—secure cloud storage for your personal data. W3DS platforms access it directly, keeping you in control.</p>
    </section>
    <section class="bg-gray rounded-[24px] p-[24px]">
        <div class="flex justify-between items-center mb-[12px]">
            <p>{usedStorage}GB used</p>
            <p>{totalStorage}GB total storage</p>
        </div>
        <progress class="progress progress-secondary bg-primary-400 w-full h-[16px] rounded-xl" value={(usedStorage/totalStorage)*100} max="100"></progress>
    </section>
    <ButtonAction class="w-full" callback={handleFinish}>Finish</ButtonAction>
</main>