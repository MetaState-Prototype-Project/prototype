import { Platform } from './platform.enum';
import { TestSocialUser } from './test-social-user';

export class TestSocialUserFactory {
    /**
     * Create a TestSocialUser instance for the specified platform
     */
    static create(platform: Platform, ename: string): TestSocialUser {
        return new TestSocialUser(platform, ename);
    }

    /**
     * Create TestSocialUser instances for both platforms from a single ename
     */
    static createForBothPlatforms(ename: string): {
        blabsy: TestSocialUser;
        pictique: TestSocialUser;
    } {
        return {
            blabsy: new TestSocialUser(Platform.BLABSY, ename),
            pictique: new TestSocialUser(Platform.PICTIQUE, ename),
        };
    }

    /**
     * Create a TestSocialUser instance with a random platform
     */
    static createRandomPlatform(ename: string): TestSocialUser {
        const platforms = [Platform.BLABSY, Platform.PICTIQUE];
        const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
        return new TestSocialUser(randomPlatform, ename);
    }
}

