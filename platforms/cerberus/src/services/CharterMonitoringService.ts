import { MessageService } from "./MessageService";
import { GroupService } from "./GroupService";
import { Group } from "../database/entities/Group";

interface CharterChangeEvent {
    groupId: string;
    groupName: string;
    oldCharter?: string;
    newCharter: string;
    changeType: 'created' | 'updated' | 'removed';
}

export class CharterMonitoringService {
    private messageService: MessageService;
    private groupService: GroupService;

    constructor() {
        this.messageService = new MessageService();
        this.groupService = new GroupService();
    }

    /**
     * Process a charter change and send appropriate system messages
     */
    async processCharterChange(event: CharterChangeEvent): Promise<void> {
        try {
            // Only process if the watchdog name is specifically set to "Cerberus"
            const charterText = event.newCharter.toLowerCase();
            
            // Look for "Watchdog Name:" followed by "**Cerberus**" on next line (handles markdown)
            let watchdogNameMatch = charterText.match(/watchdog name:\s*\n\s*\*\*([^*]+)\*\*/);
            if (!watchdogNameMatch) {
                // Alternative: look for "Watchdog Name: Cerberus" on same line
                watchdogNameMatch = charterText.match(/watchdog name:\s*([^\n\r]+)/);
            }
            
            if (!watchdogNameMatch || watchdogNameMatch[1].trim() !== 'cerberus') {
                console.log(`🔍 Cerberus not enabled for group: ${event.groupName} - watchdog name is not "Cerberus"`);
                return;
            }

            console.log(`🔍 Cerberus monitoring charter change in group: ${event.groupName}`);

            if (event.changeType === 'created') {
                await this.handleNewCharter(event);
            } else if (event.changeType === 'updated') {
                await this.handleCharterUpdate(event);
            } else if (event.changeType === 'removed') {
                await this.handleCharterRemoval(event);
            }

        } catch (error) {
            console.error("Error processing charter change:", error);
        }
    }

    /**
     * Handle when a new charter is created
     */
    private async handleNewCharter(event: CharterChangeEvent): Promise<void> {
        const hasWatchdogPolicy = this.charterMentionsWatchdog(event.newCharter);
        const hasCerberusMention = this.charterMentionsCerberus(event.newCharter);

        let messageText: string;

        if (hasWatchdogPolicy && hasCerberusMention) {
            messageText = `🎉 **New Charter Detected!** 🎉

Welcome to the group, ${event.groupName}! I'm Cerberus, your friendly charter watchdog. 🐕

🔒 **Watchdog Policy Activated!** 🔒
I see you've mentioned me in your Automated Watchdog Policy! I'll be monitoring this group for compliance.

💡 **How to use me:**
• Type "cerberus trigger" to request a compliance check
• I'll analyze recent messages for any charter violations
• I'll help keep your group running smoothly!

🛡️ **Your charter is now under my protection!** 🛡️`;
        } else if (hasWatchdogPolicy) {
            messageText = `🎉 **New Charter Detected!** 🎉

Welcome to the group, ${event.groupName}! I'm Cerberus, your friendly charter watchdog. 🐕

🔍 **Watchdog Policy Detected!** 🔍
I see you have an Automated Watchdog Policy, but you haven't mentioned me (Cerberus) yet.

💡 **Want me to monitor your group?**
Just mention "Cerberus" in your watchdog policy and I'll start protecting your charter!

🔄 **Update your charter anytime to activate my services!** 🔄`;
        } else {
            messageText = `🎉 **New Charter Detected!** 🎉

Welcome to the group, ${event.groupName}! I'm Cerberus, your friendly charter watchdog. 🐕

📋 **Charter Analysis Complete** 📋
Your charter looks great! While I'm not actively monitoring this group, I'm always here if you need me.

💡 **Want charter protection?**
Add an "Automated Watchdog Policy" section mentioning "Cerberus" and I'll become your dedicated guardian!

🔄 **Just update your charter anytime!** 🔄`;
        }

        await this.messageService.createSystemMessage({
            text: `Cerberus: ${messageText}`,
            groupId: event.groupId,
        });

        // Update Cerberus interval for this group
        const { CerberusIntervalService } = await import("./CerberusIntervalService");
        const intervalService = new CerberusIntervalService();
        await intervalService.updateGroupInterval({
            id: event.groupId,
            name: event.groupName,
            charter: event.newCharter
        } as Group);

        console.log(`✅ Welcome message sent to group: ${event.groupName}`);
    }

    /**
     * Handle when an existing charter is updated
     */
    private async handleCharterUpdate(event: CharterChangeEvent): Promise<void> {
        const oldHasWatchdog = this.charterMentionsWatchdog(event.oldCharter || '');
        const newHasWatchdog = this.charterMentionsWatchdog(event.newCharter);
        const oldHasCerberus = this.charterMentionsCerberus(event.oldCharter || '');
        const newHasCerberus = this.charterMentionsCerberus(event.newCharter);

        let messageText: string;

        if (!oldHasWatchdog && newHasWatchdog) {
            if (newHasCerberus) {
                messageText = `📝 **Charter Update Detected!** 📝

I've noticed changes to your charter in ${event.groupName}. Let me analyze what's new...

🎯 **New Watchdog Policy Added!** 🎯
Excellent! You've added an Automated Watchdog Policy to your charter.

🛡️ **Cerberus Activation Complete!** 🛡️
I'm now your dedicated charter guardian! I'll monitor all group activities for compliance.

💡 **I'm ready to help:**
• Type "cerberus trigger" for compliance checks
• I'll alert you to any violations
• Your group is now under my protection!

🐕 **Cerberus is on duty!** 🐕`;
            } else {
                messageText = `📝 **Charter Update Detected!** 📝

I've noticed changes to your charter in ${event.groupName}. Let me analyze what's new...

🎯 **New Watchdog Policy Added!** 🎯
Excellent! You've added an Automated Watchdog Policy to your charter.

🔍 **Watchdog Policy Ready!** 🔍
Your watchdog policy is set up! To activate my services, just mention "Cerberus" in the policy.

💡 **Next step:**
Update your charter to include "Cerberus" and I'll become your guardian!

🔄 **Almost there!** 🔄`;
            }
        } else if (oldHasWatchdog && !newHasWatchdog) {
            messageText = `📝 **Charter Update Detected!** 📝

I've noticed changes to your charter in ${event.groupName}. Let me analyze what's new...

⚠️ **Watchdog Policy Removed** ⚠️
I notice you've removed the Automated Watchdog Policy from your charter.

💭 **What happened:**
• I'm no longer actively monitoring this group
• Your charter is still protected by me, but I'm in standby mode
• Add the policy back anytime to reactivate my services!

🔄 **I'll be here when you need me!** 🔄`;
        } else if (oldHasCerberus && !newHasCerberus) {
            messageText = `📝 **Charter Update Detected!** 📝

I've noticed changes to your charter in ${event.groupName}. Let me analyze what's new...

😔 **Cerberus Deactivated** 😔
I see you've removed me from your watchdog policy. I'm going into standby mode.

💭 **Don't worry:**
• I'm still here, just not actively monitoring
• Your charter is still protected
• Mention "Cerberus" again anytime to reactivate me!

🐕 **I'll miss being your guardian!** 🐕`;
        } else if (!oldHasCerberus && newHasCerberus) {
            messageText = `📝 **Charter Update Detected!** 📝

I've noticed changes to your charter in ${event.groupName}. Let me analyze what's new...

🛡️ **Cerberus Activated!** 🛡️
Fantastic! You've added me to your watchdog policy. I'm now your dedicated charter guardian!

💡 **What I'll do:**
• Monitor all group activities for charter compliance
• Alert you to any violations
• Help maintain group harmony

🐕 **Cerberus is now on duty!** 🐕`;
        } else {
            messageText = `📝 **Charter Update Detected!** 📝

I've noticed changes to your charter in ${event.groupName}. Let me analyze what's new...

📋 **Charter Update Complete** 📋
Your charter has been updated successfully! I've reviewed the changes.

💡 **Current status:**
• Watchdog Policy: ${newHasWatchdog ? '✅ Active' : '❌ Not configured'}
• Cerberus Monitoring: ${newHasCerberus ? '✅ Active' : '❌ Not configured'}

🔄 **Everything looks good!** 🔄`;
        }

        await this.messageService.createSystemMessage({
            text: `Cerberus: ${messageText}`,
            groupId: event.groupId,
        });

        // Update Cerberus interval for this group
        const { CerberusIntervalService } = await import("./CerberusIntervalService");
        const intervalService = new CerberusIntervalService();
        await intervalService.updateGroupInterval({
            id: event.groupId,
            name: event.groupName,
            charter: event.newCharter
        } as Group);

        console.log(`✅ Charter update message sent to group: ${event.groupName}`);
    }

    /**
     * Handle when a charter is removed
     */
    private async handleCharterRemoval(event: CharterChangeEvent): Promise<void> {
        const messageText = `🗑️ **Charter Removed** 🗑️

I notice you've removed the charter from ${event.groupName}.

💭 **What this means:**
• I'm no longer monitoring this group for compliance
• No automated watchdog protection
• Group operates without formal charter guidelines

🔄 **Need me back?**
Just add a new charter with an Automated Watchdog Policy mentioning "Cerberus"!

🐕 **I'll be here when you're ready!** 🐕`;

        await this.messageService.createSystemMessage({
            text: `Cerberus: ${messageText}`,
            groupId: event.groupId,
        });

        // Remove Cerberus interval for this group
        const { CerberusIntervalService } = await import("./CerberusIntervalService");
        const intervalService = new CerberusIntervalService();
        intervalService.removeGroupInterval(event.groupId);

        console.log(`✅ Charter removal message sent to group: ${event.groupName}`);
    }

    /**
     * Check if a charter mentions a watchdog policy
     */
    private charterMentionsWatchdog(charterContent: string): boolean {
        if (!charterContent) return false;
        return charterContent.toLowerCase().includes('automated watchdog policy') || 
               charterContent.toLowerCase().includes('watchdog policy');
    }

    /**
     * Check if a charter mentions Cerberus
     */
    private charterMentionsCerberus(charterContent: string): boolean {
        if (!charterContent) return false;
        
        // Check if the watchdog name is specifically set to "Cerberus"
        const charterText = charterContent.toLowerCase();
        
        // Look for "Watchdog Name:" followed by "**Cerberus**" on next line (handles markdown)
        let watchdogNameMatch = charterText.match(/watchdog name:\s*\n\s*\*\*([^*]+)\*\*/);
        if (!watchdogNameMatch) {
            // Alternative: look for "Watchdog Name: Cerberus" on same line
            watchdogNameMatch = charterText.match(/watchdog name:\s*([^\n\r]+)/);
        }
        
        if (watchdogNameMatch) {
            const watchdogName = watchdogNameMatch[1].trim();
            return watchdogName === 'cerberus';
        }
        
        // Fallback: check if "Watchdog Name: Cerberus" appears anywhere
        return charterText.includes('watchdog name: cerberus');
    }

    /**
     * Send a fun periodic check-in message to groups with active charters
     */
    async sendPeriodicCheckIn(groupId: string, groupName: string): Promise<void> {
        // Get the group to check if Cerberus is enabled
        const group = await this.groupService.getGroupById(groupId);
        if (!group || !group.charter) {
            console.log(`🔍 No charter found for group: ${groupName} - skipping periodic check-in`);
            return;
        }
        
        const charterText = group.charter.toLowerCase();
        
        // Look for "Watchdog Name:" followed by "**Cerberus**" on next line (handles markdown)
        let watchdogNameMatch = charterText.match(/watchdog name:\s*\n\s*\*\*([^*]+)\*\*/);
        if (!watchdogNameMatch) {
            // Alternative: look for "Watchdog Name: Cerberus" on same line
            watchdogNameMatch = charterText.match(/watchdog name:\s*([^\n\r]+)/);
        }
        
        if (!watchdogNameMatch || watchdogNameMatch[1].trim() !== 'cerberus') {
            console.log(`🔍 Cerberus not enabled for group: ${groupName} - watchdog name is not "Cerberus"`);
            return;
        }

        const messageText = `🐕 **Cerberus Check-In!** 🐕

Just dropping by to say hello! I'm still here, watching over your charter in ${groupName}.

💡 **Remember:**
• Type "cerberus trigger" for a compliance check
• I'm monitoring for charter violations
• Your group is under my protection!

🛡️ **Everything looks good from here!** 🛡️`;

        await this.messageService.createSystemMessage({
            text: `Cerberus: ${messageText}`,
            groupId: groupId,
        });

        console.log(`✅ Periodic check-in sent to group: ${groupName}`);
    }
} 