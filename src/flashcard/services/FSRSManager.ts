import { 
    FlashcardState, 
    FlashcardProgress, 
    FSRSStorage, 
    FSRSGlobalStats,
    FSRSRating,
    CardGroup,
    HiCardState,
    DailyStats
} from '../types/FSRSTypes';
import { FSRSService } from './FSRSService';
import { FlashcardFactory } from './FlashcardFactory';
import { CardGroupRepository } from './CardGroupRepository';
import { DailyStatsService } from './DailyStatsService';
import { FlashcardEventSyncService } from './FlashcardEventSyncService';
import { SourceCardService, FlashcardSourceType } from './SourceCardService';
import { debounce } from 'obsidian';
import { HiNoteDataManager } from '../../storage/HiNoteDataManager';
import type CommentPlugin from '../../../main';

export class FSRSManager {
    public fsrsService: FSRSService;
    private cardFactory: FlashcardFactory;
    private groupRepository: CardGroupRepository;
    private dailyStatsService: DailyStatsService;
    private eventSyncService: FlashcardEventSyncService;
    private sourceCardService: SourceCardService;
    private storage: FSRSStorage;
    private plugin: CommentPlugin;
    private dataManager: HiNoteDataManager;
    private useNewStorage: boolean = false;

    constructor(plugin: CommentPlugin, dataManager?: HiNoteDataManager) {
        this.plugin = plugin;
        this.fsrsService = new FSRSService();
        this.cardFactory = new FlashcardFactory(
            () => this.storage,
            () => this.plugin.eventManager.emitFlashcardChanged(),
            this.fsrsService
        );
        this.dailyStatsService = new DailyStatsService({
            getDailyStats: () => this.storage.dailyStats,
            setDailyStats: (dailyStats: DailyStats[]) => {
                this.storage.dailyStats = dailyStats;
            },
            getGlobalStats: () => this.storage.globalStats,
            getCardGroups: () => this.storage.cardGroups,
            getParameters: () => this.fsrsService.getParameters(),
            saveDebounced: () => this.saveStorageDebounced()
        });
        this.sourceCardService = new SourceCardService({
            getStorage: () => this.storage,
            removeCardFromGroup: (cardId: string, groupId: string) => this.removeCardFromGroup(cardId, groupId),
            saveDebounced: () => this.saveStorageDebounced()
        });
        this.eventSyncService = new FlashcardEventSyncService({
            plugin: this.plugin,
            findCardsBySourceId: (sourceId, sourceType) => this.sourceCardService.findCardsBySourceId(sourceId, sourceType),
            updateCardsBySourceId: (sourceId, sourceType, newText, newAnswer) => this.sourceCardService.updateCardsBySourceId(sourceId, sourceType, newText, newAnswer),
            deleteCardsBySourceId: (sourceId, sourceType) => this.sourceCardService.deleteCardsBySourceId(sourceId, sourceType),
            saveDebounced: () => this.saveStorageDebounced(),
            emitFlashcardChanged: () => this.plugin.eventManager.emitFlashcardChanged()
        });
        
        // 如果传入了dataManager，说明要使用新存储层
        if (dataManager) {
            this.dataManager = dataManager;
            this.useNewStorage = true;
        }
        
        // 初始化为空对象，稍后会被加载的数据替换
        this.storage = {
            version: '1.0',
            cards: {},
            globalStats: {
                totalReviews: 0,
                averageRetention: 1,
                streakDays: 0,
                lastReviewDate: 0
            },
            cardGroups: [],
            uiState: {
                currentGroupName: '',
                completionMessage: null,
                groupProgress: {}
            },
            dailyStats: [] // 初始化每日学习统计数据
        };
        
        // 自动保存更改
        this.saveStorageDebounced = debounce(this.saveStorage.bind(this), 1000, true);
        
        // 异步加载存储数据
        this.loadStorage().then(storage => {
    
            this.storage = storage;
            
            // 在加载完成后初始化分组仓库
            this.groupRepository = this.createGroupRepository();
            
            // 注册事件监听
            this.eventSyncService.registerEventListeners();
        }).catch(error => {
            console.error('Loading storage data failed:', error);
            
            // Even if it fails, initialize the group repository
            this.groupRepository = this.createGroupRepository();
            
            // 注册事件监听
            this.eventSyncService.registerEventListeners();
        });
    }

    private createGroupRepository(): CardGroupRepository {
        return new CardGroupRepository({
            storage: this.storage,
            saveStorage: async () => await this.saveStorage(),
            saveStorageDebounced: () => this.saveStorageDebounced(),
            emitFlashcardChanged: () => this.plugin.eventManager.emitFlashcardChanged()
        });
    }

    private async loadStorage(): Promise<FSRSStorage> {
        // 加载存储数据
        const defaultStorage: FSRSStorage = {
            version: '1.0',
            cards: {},
            globalStats: {
                totalReviews: 0,
                averageRetention: 1,
                streakDays: 0,
                lastReviewDate: 0
            },
            cardGroups: [],
            uiState: {
                currentGroupName: '',
                completionMessage: null,
                groupProgress: {}
            },
            dailyStats: [] // 初始化每日学习统计数据
        };

        try {
            if (this.useNewStorage && this.dataManager) {
                // 使用新存储层加载数据
                const data = await this.dataManager.getFlashcardData();
                return data || defaultStorage;
            } else {
                // 使用旧存储方式
                const data = await this.plugin.loadData();

                if (!data?.fsrs) {
                    return defaultStorage;
                }

                // 确保 cardGroups 正确初始化
                const cardGroups = Array.isArray(data.fsrs.cardGroups) ? data.fsrs.cardGroups : [];

                // 创建新的存储对象，确保 cardGroups 不会被覆盖
                const storage: FSRSStorage = {
                    version: data.fsrs.version || defaultStorage.version,
                    cards: data.fsrs.cards || {},
                    globalStats: data.fsrs.globalStats || defaultStorage.globalStats,
                    cardGroups: cardGroups, // 确保使用我们检查过的 cardGroups
                    uiState: data.fsrs.uiState || defaultStorage.uiState,
                    dailyStats: data.fsrs.dailyStats || []
                };

                return storage;
            }
        } catch (error) {
            console.error('Loading storage data failed:', error);
            return defaultStorage;
        }
    }

    private async saveStorage() {
        try {
            // 确保 cardGroups 在保存前正确初始化
            if (!Array.isArray(this.storage.cardGroups)) {
                this.storage.cardGroups = [];
            }

            // 确保 cards 对象存在
            if (!this.storage.cards) {
                this.storage.cards = {};
            }

            if (this.useNewStorage && this.dataManager) {
                // 使用新存储层保存数据
                await this.dataManager.saveFlashcardData(this.storage);
            } else {
                // 使用旧存储方式
                // 加载当前数据
                const currentData = await this.plugin.loadData() || {};
                
                // 更新 FSRS 数据，保持其他数据不变
                const dataToSave = {
                    ...currentData,
                    fsrs: this.storage
                };

                await this.plugin.saveData(dataToSave);
            }
        } catch (error) {
            console.error('Saving data failed:', error);
            throw error;
        }
    }

    private saveStorageDebounced: () => void;

    private updateGlobalStats(rating: FSRSRating, retrievability: number) {
        const stats = this.storage.globalStats;
        const now = Date.now();
        const today = new Date(now).setHours(0, 0, 0, 0);
        
        // 更新总复习次数
        stats.totalReviews++;
        
        // 更新平均记忆保持率
        stats.averageRetention = (stats.averageRetention * (stats.totalReviews - 1) + retrievability) / stats.totalReviews;
        
        // 更新连续学习天数
        if (stats.lastReviewDate === 0) {
            stats.streakDays = 1;
        } else {
            const lastReviewDay = new Date(stats.lastReviewDate).setHours(0, 0, 0, 0);
            const dayDiff = (today - lastReviewDay) / (24 * 60 * 60 * 1000);
            
            if (dayDiff === 1) {
                stats.streakDays++;
            } else if (dayDiff > 1) {
                stats.streakDays = 1;
            }
        }
        
        stats.lastReviewDate = now;
    }

    /**
     * 添加卡片
     * @param text 卡片正面文本
     * @param answer 卡片背面文本
     * @param filePath 关联的文件路径
     * @param sourceId 来源ID（高亮或批注的ID）
     * @param sourceType 来源类型
     * @returns 添加的卡片
     */
    public addCard(text: string, answer: string, filePath?: string, sourceId?: string, sourceType?: 'highlight' | 'comment'): FlashcardState {
        // 创建卡片
        const card = this.cardFactory.createCard(text, answer, filePath);
        
        // 设置来源信息
        if (sourceId && sourceType) {
            card.sourceId = sourceId;
            card.sourceType = sourceType;
        }
        
        this.storage.cards[card.id] = card;
        
        // 检查并添加卡片到符合条件的分组
        this.checkAndAddCardToGroups(card);
        
        this.saveStorageDebounced();
        return card;
    }
    
    /**
     * 统一的卡片学习入口，获取指定分组的卡片
     * @param groupId 分组ID
     * @returns 分组中的卡片列表
     */
    public getCardsForStudy(groupId: string): FlashcardState[] {
        // 如果没有指定分组ID，返回空数组
        if (!groupId) {
            console.warn('No group ID specified, returning empty card list');
            return [];
        }
        
        // 获取指定分组的所有卡片
        const allCards = this.groupRepository.getCardsByGroupId(groupId);
        
        if (allCards.length === 0) {
            return [];
        }
        
        // 当前时间
        const now = Date.now();
        
        // 分离新卡片和复习卡片
        const newCards = allCards.filter(card => card.reviews === 0 && card.lastReview === 0);
        const reviewCards = allCards.filter(card => {
            // 不是新卡片，且到期需要复习
            return !(card.reviews === 0 && card.lastReview === 0) && card.nextReview <= now;
        });
        
        // 获取今天剩余的可学习数量
        const remainingNewCards = this.getRemainingNewCardsToday(groupId);
        const remainingReviews = this.getRemainingReviewsToday(groupId);
        
        // 获取分组设置
        const group = this.storage.cardGroups.find(g => g.id === groupId);
        let newCardsPerDay = 20; // 默认值
        let reviewsPerDay = 100; // 默认值
        
        if (group && group.settings) {
            if (!group.settings.useGlobalSettings) {
                // 使用分组特定设置
                newCardsPerDay = group.settings.newCardsPerDay !== undefined ? group.settings.newCardsPerDay : newCardsPerDay;
                reviewsPerDay = group.settings.reviewsPerDay !== undefined ? group.settings.reviewsPerDay : reviewsPerDay;
            } else {
                // 使用全局设置
                const params = this.fsrsService.getParameters();
                newCardsPerDay = params.newCardsPerDay;
                reviewsPerDay = params.reviewsPerDay;
            }
        }
        
        // 限制新卡片数量
        const limitedNewCards = newCards.slice(0, remainingNewCards);
        // 限制复习卡片数量
        const limitedReviewCards = reviewCards.slice(0, remainingReviews);
        
        // 合并并返回
        return [...limitedNewCards, ...limitedReviewCards];
    }
    
    /**
     * 统一的学习进度跟踪方法
     * 这是记录学习进度的唯一入口点
     * @param cardId 卡片ID
     * @param rating 评分
     * @returns 更新后的卡片状态
     */
    public trackStudyProgress(cardId: string, rating: FSRSRating): FlashcardState | null {
        // 获取卡片
        const card = this.storage.cards[cardId];
        if (!card) {
            console.error(`Tracking study progress failed: Card ${cardId} does not exist`);
            return null;
        }
        
        // Call FSRS algorithm for rating
        const isNewCard = card.lastReview === 0;
        const updatedCard = this.fsrsService.reviewCard(card, rating);
        
        // 更新卡片状态
        this.storage.cards[cardId] = updatedCard;
        
        // 更新全局统计数据
        this.updateGlobalStats(rating, updatedCard.retrievability);
        
        // 更新每日统计数据
        this.dailyStatsService.updateDailyStats(isNewCard, rating);
        
        // 同步更新所有相关分组的进度
        if (card.groupIds && card.groupIds.length > 0) {
            card.groupIds.forEach(groupId => {
                // 更新分组的学习进度
                const group = this.groupRepository.getGroupById(groupId);
                if (group) {
                    // 如果需要，可以在这里添加分组特定的进度跟踪逻辑
                }
            });
        }
        
        // 保存更改 - 立即保存而不是延迟保存，确保状态被正确保存
        this.saveStorage();
        
        // 调试信息：输出更新后的卡片状态

        
        // 触发卡片变化事件
        this.plugin.eventManager.emitFlashcardChanged();
        
        // 返回更新后的卡片
        return this.storage.cards[cardId];
    }
    
    /**
     * 获取卡片在不同评分下的预测结果
     * @param cardId 卡片ID
     * @returns 不同评分下的预测结果，如果卡片不存在则返回 null
     */
    public getCardPredictions(cardId: string): Record<FSRSRating, FlashcardState> | null {
        const card = this.storage.cards[cardId];
        if (!card) return null;
        
        // 使用 FSRSService 的 getSchedulingCards 方法获取预测结果
        return this.fsrsService.getSchedulingCards(card);
    }
    
    /**
     * 检查卡片是否符合已有分组的筛选条件，并将其添加到相应的分组中
     * @param card 要检查的卡片
     * @returns 添加到的分组数量
     */
    private checkAndAddCardToGroups(card: FlashcardState): number {
        if (!card || !card.id) return 0;
        

        
        // 获取所有分组
        const allGroups = this.groupRepository.getCardGroups();
        if (!allGroups || allGroups.length === 0) {

            return 0;
        }
        

        
        // 记录添加到的分组数量
        let addedCount = 0;
        
        // 逐个检查分组
        for (const group of allGroups) {
            if (!group.filter || group.filter.trim().length === 0) {

                continue;
            }
            

            
            // 创建一个仅包含当前卡片的数组
            const singleCardArray = [card];
            
            // 使用 CardGroupRepository 的筛选逻辑检查卡片是否符合条件
            const isMatch = this.checkCardMatchesGroupFilter(card, group.filter);
            
            if (isMatch) {

                
                // 添加卡片到分组
                const added = this.addCardToGroup(card.id, group.id);
                if (added) {

                    addedCount++;
                } else {

                }
            } else {

            }
        }
        
        if (addedCount > 0) {

        } else {

        }
        
        return addedCount;
    }
    
    /**
     * 检查卡片是否符合分组的筛选条件
     * @param card 要检查的卡片
     * @param filter 分组的筛选条件
     * @returns 是否符合条件
     */
    private checkCardMatchesGroupFilter(card: FlashcardState, filter: string): boolean {
        if (!card || !card.filePath || !filter || filter.trim().length === 0) {
            return false;
        }
        
        // 按逗号分割多个筛选条件
        const filterConditions = filter.split(',').map(f => f.trim()).filter(f => f.length > 0);
        if (filterConditions.length === 0) {
            return false;
        }
        
        // Wiki 链接正则表达式
        const wikiLinkRegex = /\[\[([^\]]+)\]\]/;
        
        // 处理卡片文件路径
        const filePath = card.filePath.toLowerCase();
        const fileName = filePath.split('/').pop() || ''; // 获取文件名
        const fileNameWithoutExt = fileName.replace(/\.md$/i, ''); // 移除 .md 扩展名
        
        // 检查每个筛选条件
        for (const condition of filterConditions) {
            const conditionLower = condition.toLowerCase();
            
            // 检查是否是 Wiki 链接格式
            const wikiMatch = conditionLower.match(wikiLinkRegex);
            
            if (wikiMatch) {
                // 如果是 Wiki 链接格式，提取链接内容并匹配文件名
                const linkText = wikiMatch[1].toLowerCase();
                
                // 检查文件名是否匹配
                if (fileNameWithoutExt === linkText || fileName === linkText) {

                    return true;
                }
            } else {
                // 如果不是 Wiki 链接格式，直接匹配文件路径
                if (filePath.includes(conditionLower)) {

                    return true;
                }
                
                // 检查卡片内容
                if (card.text && card.text.toLowerCase().includes(conditionLower)) {

                    return true;
                }
                
                // 检查卡片答案
                if (card.answer && card.answer.toLowerCase().includes(conditionLower)) {

                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 根据来源ID查找卡片
     * @param sourceId 来源ID（高亮或批注的ID）
     * @param sourceType 来源类型
     * @returns 找到的卡片列表
     */
    public findCardsBySourceId(sourceId: string, sourceType?: FlashcardSourceType): FlashcardState[] {
        return this.sourceCardService.findCardsBySourceId(sourceId, sourceType);
    }
    
    /**
     * 根据来源ID删除卡片
     * @param sourceId 来源ID（高亮或批注的ID）
     * @param sourceType 来源类型
     * @returns 删除的卡片数量
     */
    public deleteCardsBySourceId(sourceId: string, sourceType?: FlashcardSourceType): number {
        return this.sourceCardService.deleteCardsBySourceId(sourceId, sourceType);
    }
    
    /**
     * 根据来源ID更新卡片内容
     * @param sourceId 来源ID
     * @param sourceType 来源类型
     * @param newText 新的文本内容
     * @param newAnswer 新的答案内容
     * @returns 更新的卡片数量
     */
    public updateCardsBySourceId(sourceId: string, sourceType: FlashcardSourceType, newText?: string, newAnswer?: string): number {
        return this.sourceCardService.updateCardsBySourceId(sourceId, sourceType, newText, newAnswer);
    }

    /**
     * 获取所有卡片的总数（只统计自定义分组中的卡片）
     * @returns 卡片总数
     */
    public getTotalCardsCount(): number {
        // 获取所有自定义分组
        const allGroups = this.getCardGroups() || [];
        if (allGroups.length === 0) {
            return 0; // 如果没有自定义分组，返回0
        }
        
        // 如果只有一个分组，直接返回该分组的卡片数量
        if (allGroups.length === 1 && allGroups[0].cardIds) {
            return allGroups[0].cardIds.length;
        }
        
        // 收集所有自定义分组中的卡片ID
        const customGroupCards = new Set<string>();
        
        // 遍历所有自定义分组，收集卡片ID
        allGroups.forEach(group => {
            if (group.cardIds) {
                group.cardIds.forEach(cardId => {
                    if (this.storage.cards[cardId]) {
                        customGroupCards.add(cardId);
                    }
                });
            }
        });
        
        // 返回去重后的卡片数量
        return customGroupCards.size;
    }

    public getProgress(): FlashcardProgress {
        // 获取所有学习分组中的卡片
        const allGroupCards = this.getAllGroupCards();
        const now = Date.now();
        
        // 如果没有学习分组或分组中没有卡片，则返回全部为0的统计
        if (allGroupCards.length === 0) {
            return {
                due: 0,
                newCards: 0,
                learned: 0,
                retention: this.storage.globalStats.averageRetention
            };
        }
        
        return {
            due: allGroupCards.filter(c => c.nextReview <= now).length,
            newCards: allGroupCards.filter(c => c.lastReview === 0).length,
            learned: allGroupCards.filter(c => c.lastReview > 0).length,
            retention: this.storage.globalStats.averageRetention
        };
    }

    /**
     * 获取所有学习分组中的卡片（去重）
     * @returns 所有学习分组中的卡片数组
     */
    private getAllGroupCards(): FlashcardState[] {
        // 获取所有分组
        const groups = this.groupRepository.getCardGroups();
        if (!groups || groups.length === 0) {

            return [];
        }
        
        // 用于去重的卡片ID集合
        const uniqueCardIds = new Set<string>();
        const uniqueCards: FlashcardState[] = [];
        
        // 遍历所有分组，收集卡片
        for (const group of groups) {
            const groupCards = this.groupRepository.getCardsByGroupId(group.id);
            for (const card of groupCards) {
                if (!uniqueCardIds.has(card.id)) {
                    uniqueCardIds.add(card.id);
                    uniqueCards.push(card);
                }
            }
        }
        

        return uniqueCards;
    }

    public getStats(): FSRSGlobalStats {
        return { ...this.storage.globalStats };
    }

    // UI状态管理
    public getUIState(): HiCardState {
        return { ...this.storage.uiState };
    }

    public updateUIState(state: Partial<HiCardState>) {
        this.storage.uiState = {
            ...this.storage.uiState,
            ...state
        };
        this.saveStorageDebounced();
    }

    /**
     * 删除卡片
     * @param cardId 卡片ID
     * @returns 是否删除成功
     */
    public deleteCard(cardId: string): boolean {
        const card = this.storage.cards[cardId];
        if (!card) return false;
        
        // 先从所有分组中移除卡片引用（在删除卡片之前）
        if (card.groupIds) {
            for (const groupId of card.groupIds) {
                this.removeCardFromGroup(cardId, groupId);
            }
        }
        
        // 然后从存储中删除卡片
        delete this.storage.cards[cardId];
        this.saveStorageDebounced();
        this.plugin.eventManager.emitFlashcardChanged();
        return true;
    }

    /**
     * 根据文件路径获取卡片
     * @param filePath 文件路径
     * @returns 该文件下的卡片列表
     */
    public getCardsByFile(filePath: string): FlashcardState[] {
        // 调用 FlashcardFactory 的方法
        return this.cardFactory.getCardsByFile(filePath);
    }

    /**
     * 获取插件实例（公共方法，供外部访问）
     * @returns 插件实例
     */
    public getPlugin(): CommentPlugin {
        return this.plugin;
    }
    
    /**
     * 公共保存方法，供外部调用
     * @returns Promise<void>
     */
    public async saveStoragePublic(): Promise<void> {
        return this.saveStorage();
    }

    public async renameGroupUIState(oldName: string, newName: string): Promise<void> {
        const uiState = this.storage.uiState;

        if (uiState.groupProgress?.[oldName]) {
            uiState.groupProgress[newName] = uiState.groupProgress[oldName];
            delete uiState.groupProgress[oldName];
        }

        if (uiState.currentGroupName === oldName) {
            uiState.currentGroupName = newName;
        }

        await this.saveStorage();
    }

    /**
     * 重置今天的学习统计。
     * @returns 如果找到并移除了今天的统计数据，返回 true。
     */
    public async resetTodayStats(): Promise<boolean> {
        const reset = this.dailyStatsService.resetTodayStats();
        if (reset) {
            await this.saveStorage();
        }
        return reset;
    }

    public getDailyStats(): DailyStats[] {
        return this.dailyStatsService.getDailyStats();
    }

    /**
     * 检查今天是否还能学习新卡片
     * @param groupId 可选的分组ID，如果提供则使用分组特定的设置
     */
    public canLearnNewCardsToday(groupId?: string): boolean {
        return this.dailyStatsService.canLearnNewCardsToday(groupId);
    }

    /**
     * 检查今天是否还能复习卡片
     * @param groupId 可选的分组ID，如果提供则使用分组特定的设置
     */
    public canReviewCardsToday(groupId?: string): boolean {
        return this.dailyStatsService.canReviewCardsToday(groupId);
    }

    /**
     * 获取今天剩余的新卡片学习数量
     * @param groupId 可选的分组ID，如果提供则使用分组特定的设置
     */
    public getRemainingNewCardsToday(groupId?: string): number {
        return this.dailyStatsService.getRemainingNewCardsToday(groupId);
    }

    /**
     * 获取今天剩余的复习卡片数量
     * @param groupId 可选的分组ID，如果提供则使用分组特定的设置
     */
    public getRemainingReviewsToday(groupId?: string): number {
        return this.dailyStatsService.getRemainingReviewsToday(groupId);
    }
    /**
     * 创建新分组
     * @param group 分组数据（不含ID）
     * @returns 创建的分组
     */
    public async createCardGroup(group: Omit<CardGroup, 'id'>): Promise<CardGroup> {
        // 确保 cardGroups 数组已初始化
        if (!Array.isArray(this.storage.cardGroups)) {
            this.storage.cardGroups = [];
        }
        
        // 创建新分组
        const newGroup = await this.groupRepository.createCardGroup(group);
        
        // 确保分组已添加到存储中
        if (!this.storage.cardGroups.some(g => g.id === newGroup.id)) {
            this.storage.cardGroups.push(newGroup);
        }
        
        // 保存更改
        await this.saveStorage();
        return newGroup;
    }
    
    /**
     * 更新分组
     * @param groupId 分组ID
     * @param updates 要更新的字段
     * @returns 是否更新成功
     */
    public async updateCardGroup(groupId: string, updates: Partial<Omit<CardGroup, 'id'>>): Promise<boolean> {
        // 获取更新前的过滤条件
        const oldGroup = this.groupRepository.getGroupById(groupId);
        const oldFilter = oldGroup?.filter;
        
        // 更新分组
        const result = await this.groupRepository.updateCardGroup(groupId, updates);
        if (!result) return false;
        
        // 如果更新了过滤条件，重新生成卡片
        if (updates.filter !== undefined && updates.filter !== oldFilter) {
            // 清空现有卡片
            const group = this.groupRepository.getGroupById(groupId);
            if (group && group.cardIds) {
                for (const cardId of [...group.cardIds]) {
                    this.removeCardFromGroup(cardId, groupId);
                }
            }
            
        }
        
        // 保存更改
        await this.saveStorage();
        
        return true;
    }
    
    /**
     * 删除分组
     * @param groupId 分组ID
     * @param deleteCards 是否同时删除分组内的卡片
     * @returns 是否删除成功
     */
    public async deleteCardGroup(groupId: string, deleteCards = false): Promise<boolean> {
        // 删除分组，不删除卡片
        const result = await this.groupRepository.deleteCardGroup(groupId, false);
        if (!result) return false;
        
        // 保存更改
        try {
            await this.saveStorage();
            return true;
        } catch (error) {
            // 删除失败，但无法恢复（分组已被删除）
            return false;
        }
    }
    
    /**
     * 获取分组中的所有卡片（根据过滤条件）
     * @param group 分组对象
     * @returns 符合条件的卡片列表
     */
    public getCardsInGroup(group: CardGroup): FlashcardState[] {
        return this.groupRepository.getCardsByGroupId(group.id);
    }
    
    /**
     * 将卡片添加到分组
     * @param cardId 卡片ID
     * @param groupId 分组ID
     * @returns 是否添加成功
     */
    public addCardToGroup(cardId: string, groupId: string): boolean {
        const result = this.groupRepository.addCardToGroup(cardId, groupId);
        if (result) {
            // 保存更改
            this.saveStorageDebounced();
        }
        return result;
    }
    
    /**
     * 从分组中移除卡片
     * @param cardId 卡片ID
     * @param groupId 分组ID
     * @returns 是否移除成功
     */
    public removeCardFromGroup(cardId: string, groupId: string): boolean {
        const result = this.groupRepository.removeCardFromGroup(cardId, groupId);
        if (result) {
            // 保存更改
            this.saveStorageDebounced();
        }
        return result;
    }
    
    /**
     * 获取分组的学习进度
     * @param groupId 分组ID
     * @returns 分组的学习进度
     */
    public getGroupProgress(groupId: string): FlashcardProgress | null {
        return this.groupRepository.getGroupProgress(groupId);
    }
    
    /**
     * 获取分组中的所有卡片
     * @param groupId 分组ID
     * @returns 分组中的卡片列表
     */
    public getCardsByGroupId(groupId: string): FlashcardState[] {
        return this.groupRepository.getCardsByGroupId(groupId);
    }
    
    /**
     * 获取所有卡片的数组
     * @returns 所有卡片的数组
     */
    public getAllCards(): FlashcardState[] {
        return Object.values(this.storage.cards);
    }
    
    /**
     * 获取所有分组
     * @returns 所有分组列表
     */
    public getCardGroups(): CardGroup[] {
        return this.groupRepository.getCardGroups();
    }
    /**
     * 清理所有分组中的无效卡片引用
     * 这个方法会移除分组中指向不存在卡片的引用
     */
    public cleanupInvalidCardReferences(): number {
        return this.groupRepository.cleanupInvalidCardReferences();
    }
}
