import { Platform, Plugin, requestUrl } from 'obsidian';

interface VaultAdapterWithBasePath {
    basePath: string;
}

interface LicenseData {
    key: string;
    token: string;
    features?: string[];
    vaultId?: string;
    lastVerified?: number;
}

interface LicenseVerificationResponse {
    valid?: boolean;
    token?: string;
    features?: string[];
}

export class LicenseManager {
    private plugin: Plugin;
    private readonly STORAGE_KEY = 'flashcard-license';
    private readonly VAULT_ID_KEY = 'vault-id';
    private readonly API_URL = 'https://hi-note-license-server-production.up.railway.app';
    private readonly FEATURES = ['flashcard'];
    private readonly VERIFICATION_INTERVAL_DAYS = 7; // 검증 간격 (일)
    private licenseToken: string | null = null;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    // Vault ID를 생성합니다 (볼트 고유 식별자)
    private async generateVaultId(): Promise<string> {
        try {
            // 먼저 저장소에서 Vault ID를 가져오려 시도합니다
            const data = await this.plugin.loadData() || {};
            if (data[this.VAULT_ID_KEY]) {
                return data[this.VAULT_ID_KEY];
            }
            
            // 저장된 Vault ID가 없으면 새로 생성합니다
            // 비교적 안정적인 요소를 주로 사용합니다
            // 저장 경로 정보를 가져옵니다
            const adapter = this.plugin.app.vault.adapter;
            // 더 안전한 방식으로 경로 정보를 가져옵니다
            let vaultPath = this.plugin.app.vault.getName();
            // adapter의 다른 속성이나 메서드를 사용하여 추가 정보를 가져오려 시도합니다
            if (this.hasBasePath(adapter)) {
                vaultPath = adapter.basePath + '/' + vaultPath;
            }
            const platform = Platform.isWin ? 'windows' : Platform.isMacOS ? 'macos' : Platform.isLinux ? 'linux' : Platform.isIosApp ? 'ios' : Platform.isAndroidApp ? 'android' : 'unknown';
            
            // 요소를 조합합니다 (자주 변경되는 요소는 줄입니다)
            const vaultInfo = [vaultPath, platform].join('|');
            
            // SHA-256 해시를 사용합니다
            const encoder = new TextEncoder();
            const data2 = encoder.encode(vaultInfo);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data2);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const vaultId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // 생성된 Vault ID를 저장합니다
            await this.saveVaultId(vaultId);

            return vaultId;
        } catch {

            // 오류가 발생하면 단순 vault 경로 해시로 대체합니다
            const vaultPath = this.plugin.app.vault.getName();
            const encoder = new TextEncoder();
            const data = encoder.encode(vaultPath);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const vaultId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // 생성된 Vault ID를 저장합니다
            await this.saveVaultId(vaultId);

            return vaultId;
        }
    }

    // Vault ID를 저장합니다
    private async saveVaultId(vaultId: string): Promise<void> {
        const currentData = await this.plugin.loadData() || {};
        await this.plugin.saveData({
            ...currentData,
            [this.VAULT_ID_KEY]: vaultId
        });
    }

    // 라이선스를 활성화합니다
    async activateLicense(licenseKey: string): Promise<boolean> {
        try {

            const vaultId = await this.generateVaultId();

            const url = `${this.API_URL}/api/verify`;

            // vaultId를 사용하지만 API 요청에서는 서버 호환성을 위해 deviceId 필드명을 유지합니다
            const requestBody = { licenseKey, deviceId: vaultId };

            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = response.json as LicenseVerificationResponse;

            if (data.valid && data.token) {
                // 라이선스 정보를 저장합니다
                const currentData = await this.plugin.loadData() || {};
                await this.plugin.saveData({
                    ...currentData,
                    [this.STORAGE_KEY]: {
                        key: licenseKey,
                        token: data.token,
                        features: data.features,
                        vaultId: vaultId, // 현재 Vault ID를 저장합니다
                        lastVerified: Date.now()
                    }
                });
                
                this.licenseToken = data.token;
                return true;
            }

            return false;
        } catch {

            return false;
        }
    }

    // 특정 기능이 활성화되어 있는지 확인합니다
    async isFeatureEnabled(feature: string): Promise<boolean> {
        const data = await this.plugin.loadData();
        const licenseData = data?.[this.STORAGE_KEY] as LicenseData | undefined;
        return licenseData?.features?.includes(feature) || false;
    }

    // 활성화 여부를 확인합니다
    async isActivated(): Promise<boolean> {
        try {
            const data = await this.plugin.loadData();
            const licenseData = data?.[this.STORAGE_KEY] as LicenseData | undefined;
            
            // 로컬에 라이선스 정보가 없으면 바로 false를 반환합니다
            if (!licenseData?.token) {
                return false;
            }

            // 재검증이 필요한지 확인합니다
            const shouldVerify = this.shouldVerifyLicense(licenseData.lastVerified);
            
            // 재검증이 필요하면 서버에 검증 요청을 보냅니다
            if (shouldVerify) {
                return this.verifyWithServer(licenseData);
            }

            // licenseToken이 이미 있으면 바로 true를 반환합니다
            if (this.licenseToken) {
                return true;
            }

            // licenseToken을 설정합니다
            this.licenseToken = licenseData.token;
            return true;
        } catch {

            return false;
        }
    }

    // 라이선스 재검증이 필요한지 확인합니다
    private shouldVerifyLicense(lastVerified?: number): boolean {
        if (!lastVerified) return true;
        
        const now = Date.now();
        const daysSinceLastVerification = (now - lastVerified) / (1000 * 60 * 60 * 24);
        
        return daysSinceLastVerification >= this.VERIFICATION_INTERVAL_DAYS;
    }

    // 서버에서 라이선스를 검증합니다
    private async verifyWithServer(licenseData: LicenseData): Promise<boolean> {
        try {
            const vaultId = await this.generateVaultId();
            
            // 현재 Vault ID가 활성화 시의 Vault ID와 다른지 확인합니다
            const activationVaultId = licenseData.vaultId;
            const isVaultChanged = activationVaultId && activationVaultId !== vaultId;
            
            const response = await requestUrl({
                url: `${this.API_URL}/api/verify`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${licenseData.token}`
                },
                body: JSON.stringify({
                    licenseKey: licenseData.key,
                    deviceId: vaultId, // 서버 호환성을 위해 기존 필드명을 사용합니다
                    isDeviceChanged: isVaultChanged // 서버 호환성을 위해 기존 필드명을 사용합니다
                })
            });

            const result = response.json as LicenseVerificationResponse | null;
            
            if (!result) {
                // 서버 오류가 발생해도 로컬 토큰이 있으면 계속 사용을 허용합니다
                // 네트워크 문제 시에도 사용자가 플러그인을 사용할 수 있도록 합니다
                if (this.licenseToken) {
                    return true;
                }
                return false;
            }
            if (result.valid) {
                // 검증 시간, 토큰, 디바이스 ID를 업데이트합니다
                const currentData = await this.plugin.loadData() || {};
                await this.plugin.saveData({
                    ...currentData,
                    [this.STORAGE_KEY]: {
                        ...licenseData,
                        token: result.token || licenseData.token,
                        vaultId: vaultId, // Vault ID를 업데이트합니다
                        lastVerified: Date.now()
                    }
                });
                
                this.licenseToken = result.token || licenseData.token;
                return true;
            }
            
            return false;
        } catch {

            // 서버 검증에 실패해도 로컬 토큰이 있으면 계속 사용을 허용합니다
            // 네트워크 문제 시에도 사용자가 플러그인을 사용할 수 있도록 합니다
            return !!this.licenseToken;
        }
    }

    private hasBasePath(adapter: unknown): adapter is VaultAdapterWithBasePath {
        return typeof adapter === 'object'
            && adapter !== null
            && 'basePath' in adapter
            && typeof (adapter as VaultAdapterWithBasePath).basePath === 'string';
    }
}
