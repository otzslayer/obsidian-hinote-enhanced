import { Notice } from "obsidian";
import { CardGroup } from "../../types/FSRSTypes";
import { t } from "../../../i18n";
import type { FlashcardComponentContext } from "../FlashcardComponentContext";
import { createFlashcardGroupModal, FlashcardGroupFormValues } from "./FlashcardGroupModal";

/**
 * 플래시카드 그룹 매니저, 그룹의 생성, 편집 및 삭제 처리 담당
 */
export class FlashcardGroupManager {
    private component: FlashcardComponentContext;

    constructor(component: FlashcardComponentContext) {
        this.component = component;
    }

    /**
     * 그룹 생성 모달 표시
     */
    public showCreateGroupModal() {
        this.showEditGroupModal();
    }

    /**
     * 그룹 편집 모달 표시
     * @param group 편집할 그룹
     */
    public showEditGroupModal(group?: CardGroup) {
        const modal = createFlashcardGroupModal(group);

        modal.saveButton.addEventListener('click', () => {
            void this.saveGroupFromModal(modal, group);
        });

        modal.cancelButton.addEventListener('click', () => {
            modal.close();

            if (group) {
                this.component.getRenderer().render();
            }
        });
    }

    private async saveGroupFromModal(modal: ReturnType<typeof createFlashcardGroupModal>, group?: CardGroup): Promise<void> {
        const values = modal.getValues();
        if (!values.name) {
            new Notice(t('Group name cannot be empty'));
            return;
        }

        const fsrsManager = this.component.getFsrsManager();

        if (group) {
            await this.updateExistingGroup(group, values);
        } else {
            await fsrsManager.createCardGroup({
                name: values.name,
                filter: values.filter,
                isReversed: values.isReversed,
                createdTime: Date.now(),
                sortOrder: fsrsManager.getCardGroups().length,
                settings: this.createGroupSettings(values)
            });

            new Notice(t('Group created'));
            this.refreshFlashcardView();
        }

        modal.close();

        if (group) {
            this.component.getRenderer().render();
        }
    }

    private async updateExistingGroup(group: CardGroup, values: FlashcardGroupFormValues): Promise<void> {
        const fsrsManager = this.component.getFsrsManager();
        const oldName = group.name;

        try {
            await fsrsManager.updateCardGroup(group.id, this.createGroupUpdate(values));
            await fsrsManager.renameGroupUIState(oldName, values.name);

            if (this.component.getCurrentGroupName() === oldName) {
                this.component.setCurrentGroupName(values.name);
            }

            this.refreshFlashcardView();
            new Notice(t('Group update successful'));
        } catch (error) {
            console.error('Update group failed:', error);
            new Notice(t('Update group failed'));
        }
    }

    private refreshFlashcardView(): void {
        this.component.refreshCardList();
        this.component.getRenderer().render();
    }

    private createGroupUpdate(values: FlashcardGroupFormValues): Partial<CardGroup> {
        return {
            name: values.name,
            filter: values.filter,
            isReversed: values.isReversed,
            settings: this.createGroupSettings(values),
            lastUpdated: Date.now()
        };
    }

    private createGroupSettings(values: FlashcardGroupFormValues): CardGroup['settings'] {
        return {
            useGlobalSettings: values.useGlobalSettings,
            newCardsPerDay: values.useGlobalSettings ? undefined : values.newCardsPerDay,
            reviewsPerDay: values.useGlobalSettings ? undefined : values.reviewsPerDay
        };
    }
}
