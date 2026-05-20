/** Shared with projects / app-bottom-sheet / map controls */
export declare const messagingChrome: {
    unread: string;
    connected: string;
    connecting: string;
};
export declare const messagingStyles: {
    overlayRoot: {
        zIndex: number;
        pointerEvents: "box-none";
        position: "absolute";
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
    };
    panelOuter: {
        shadowColor: string;
        shadowOffset: {
            width: number;
            height: number;
        };
        shadowOpacity: number;
        shadowRadius: number;
        elevation: number;
        position: "absolute";
        left: number;
        right: number;
        bottom: number;
        zIndex: number;
        borderTopLeftRadius: number;
        borderTopRightRadius: number;
        overflow: "hidden";
        borderTopWidth: number;
        borderTopColor: string;
        backgroundColor: string;
    };
    resizeHandle: {
        alignItems: "center";
        paddingTop: number;
        paddingBottom: number;
        backgroundColor: string;
    };
    resizeGrab: {
        width: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
    };
    panelHeader: {
        flexDirection: "row";
        alignItems: "center";
        justifyContent: "space-between";
        paddingHorizontal: number;
        paddingTop: number;
        paddingBottom: number;
        borderBottomWidth: number;
        borderBottomColor: string;
        backgroundColor: string;
    };
    panelHeaderTitle: {
        fontSize: number;
        fontWeight: "700";
        color: string;
        letterSpacing: number;
    };
    iconButton: {
        width: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
        alignItems: "center";
        justifyContent: "center";
    };
    panelBody: {
        flex: number;
        backgroundColor: string;
    };
    wsStatus: {
        flexDirection: "row";
        alignItems: "center";
        gap: number;
        paddingHorizontal: number;
        paddingVertical: number;
        borderTopWidth: number;
        borderTopColor: string;
        backgroundColor: string;
    };
    wsStatusText: {
        color: string;
        fontSize: 11;
        fontWeight: "500";
    };
    statusDot: {
        width: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
    };
    inboxHeader: {
        flexDirection: "row";
        alignItems: "center";
        justifyContent: "space-between";
        paddingHorizontal: number;
        paddingTop: number;
        paddingBottom: number;
        backgroundColor: string;
    };
    inboxTitle: {
        fontSize: 18;
        fontWeight: "700";
        color: string;
        letterSpacing: number;
    };
    searchBar: {
        flexDirection: "row";
        alignItems: "center";
        marginHorizontal: number;
        marginVertical: number;
        paddingHorizontal: number;
        height: number;
        borderRadius: number;
        borderWidth: number;
        borderColor: string;
        backgroundColor: string;
        gap: number;
    };
    searchInput: {
        flex: number;
        fontSize: 16;
        color: string;
        paddingVertical: number;
    };
    convItem: {
        flexDirection: "row";
        alignItems: "center";
        backgroundColor: string;
        minHeight: number;
        paddingVertical: number;
        paddingLeft: number;
        paddingRight: number;
        borderBottomWidth: number;
        borderBottomColor: string;
        gap: number;
    };
    convFavoriteButton: {
        width: number;
        height: number;
        alignItems: "center";
        justifyContent: "center";
    };
    avatar: {
        width: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
        alignItems: "center";
        justifyContent: "center";
    };
    convName: {
        color: string;
        fontSize: 14;
        fontWeight: "500";
        flex: number;
        letterSpacing: number;
    };
    convPreview: {
        color: string;
        fontSize: 12;
        flex: number;
        lineHeight: number;
    };
    convTime: {
        color: string;
        fontSize: 11;
    };
    unreadBadge: {
        minWidth: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
        alignItems: "center";
        justifyContent: "center";
        paddingHorizontal: number;
    };
    unreadText: {
        color: string;
        fontSize: 11;
        fontWeight: "700";
    };
    emptyState: {
        flex: number;
        alignItems: "center";
        justifyContent: "center";
        padding: number;
        gap: number;
        backgroundColor: string;
    };
    emptyText: {
        color: string;
        fontSize: 16;
        textAlign: "center";
    };
    chatHeader: {
        flexDirection: "row";
        alignItems: "center";
        paddingHorizontal: number;
        paddingVertical: number;
        backgroundColor: string;
        borderBottomWidth: number;
        borderBottomColor: string;
        gap: number;
    };
    messagesList: {
        padding: number;
        gap: number;
        backgroundColor: string;
    };
    bubbleRowOwn: {
        alignItems: "flex-end";
    };
    bubbleRowOther: {
        alignItems: "flex-start";
    };
    senderName: {
        color: string;
        fontSize: 11;
        marginBottom: number;
        marginLeft: number;
    };
    bubbleOwn: {
        maxWidth: "82%";
        backgroundColor: string;
        borderRadius: number;
        paddingHorizontal: number;
        paddingVertical: number;
        borderWidth: number;
        borderColor: string;
    };
    bubbleOther: {
        maxWidth: "82%";
        backgroundColor: string;
        borderRadius: number;
        paddingHorizontal: number;
        paddingVertical: number;
        borderWidth: number;
        borderColor: string;
    };
    bubbleText: {
        color: string;
        fontSize: 14;
    };
    inputBar: {
        flexDirection: "row";
        alignItems: "flex-end";
        padding: number;
        gap: number;
        borderTopWidth: number;
        borderTopColor: string;
        backgroundColor: string;
    };
    textInput: {
        flex: number;
        maxHeight: number;
        minHeight: number;
        borderRadius: number;
        borderWidth: number;
        borderColor: string;
        backgroundColor: string;
        color: string;
        paddingHorizontal: number;
        paddingVertical: number;
        fontSize: 16;
    };
    sendBtn: {
        shadowColor: string;
        shadowOffset: {
            width: number;
            height: number;
        };
        shadowOpacity: number;
        shadowRadius: number;
        elevation: number;
        width: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
        alignItems: "center";
        justifyContent: "center";
    };
    contactRow: {
        flexDirection: "row";
        alignItems: "center";
        backgroundColor: string;
        minHeight: number;
        paddingVertical: number;
        paddingHorizontal: number;
        borderBottomWidth: number;
        borderBottomColor: string;
        gap: number;
    };
    linkText: {
        color: string;
        fontSize: 14;
        fontWeight: "600";
    };
    inboxFilterRow: {
        paddingTop: number;
        paddingBottom: number;
        paddingHorizontal: number;
        backgroundColor: string;
        borderBottomWidth: number;
        borderBottomColor: string;
    };
    inboxFilterStrip: {
        flexDirection: "row";
        alignItems: "stretch";
        gap: number;
        width: "100%";
    };
    filterChip: {
        flex: number;
        minWidth: number;
        paddingVertical: number;
        paddingHorizontal: number;
        borderRadius: number;
        borderWidth: number;
        borderColor: string;
        backgroundColor: string;
        alignItems: "center";
        justifyContent: "center";
    };
    filterChipActive: {
        backgroundColor: string;
        borderColor: string;
    };
    filterChipText: {
        color: string;
        fontSize: 11;
        fontWeight: "600";
        textAlign: "center";
    };
    filterChipTextActive: {
        color: string;
    };
    reactionRow: {
        flexDirection: "row";
        flexWrap: "wrap";
        gap: number;
        marginTop: number;
    };
    reactionChip: {
        flexDirection: "row";
        alignItems: "center";
        paddingHorizontal: number;
        paddingVertical: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
    };
    reactionChipActive: {
        backgroundColor: string;
        borderColor: string;
    };
    reactionPicker: {
        flexDirection: "row";
        flexWrap: "wrap";
        gap: number;
        padding: number;
        marginBottom: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
    };
    reactionEmojiBtn: {
        padding: number;
        minWidth: number;
        alignItems: "center";
    };
    chatImage: {
        width: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
    };
    attachMenu: {
        flexDirection: "row";
        alignItems: "center";
        justifyContent: "space-around";
        paddingVertical: number;
        paddingHorizontal: number;
        borderTopWidth: number;
        borderTopColor: string;
        backgroundColor: string;
    };
    attachMenuBtn: {
        alignItems: "center";
        gap: number;
        padding: number;
        minWidth: number;
    };
    attachMenuLabel: {
        color: string;
        fontSize: 11;
        fontWeight: "500";
    };
    groupActionBar: {
        paddingHorizontal: number;
        paddingTop: number;
        paddingBottom: number;
        gap: number;
        borderTopWidth: number;
        borderTopColor: string;
        backgroundColor: string;
    };
    groupDeleteBtn: {
        minHeight: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
        alignItems: "center";
        justifyContent: "center";
        paddingHorizontal: number;
    };
    groupPrimaryBtn: {
        shadowColor: string;
        shadowOffset: {
            width: number;
            height: number;
        };
        shadowOpacity: number;
        shadowRadius: number;
        elevation: number;
        minHeight: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
        alignItems: "center";
        justifyContent: "center";
        paddingHorizontal: number;
    };
    groupPrimaryBtnText: {
        color: string;
        fontSize: 14;
        fontWeight: "600";
    };
    groupDeleteBtnText: {
        color: string;
        fontSize: 14;
        fontWeight: "600";
    };
    groupSearchBar: {
        flexDirection: "row";
        alignItems: "center";
        paddingHorizontal: number;
        minHeight: number;
        borderRadius: number;
        borderWidth: number;
        borderColor: string;
        backgroundColor: string;
        gap: number;
    };
    memberTagsSection: {
        minHeight: number;
        paddingVertical: number;
    };
    memberTagsWrap: {
        flexDirection: "row";
        flexWrap: "wrap";
        gap: number;
    };
    memberTagsHint: {
        color: string;
        fontSize: 12;
        fontStyle: "italic";
    };
    memberTagChip: {
        flexDirection: "row";
        alignItems: "center";
        maxWidth: "100%";
        paddingLeft: number;
        paddingRight: number;
        paddingVertical: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
        gap: number;
    };
    memberTagText: {
        color: string;
        fontSize: 12;
        fontWeight: "500";
        flexShrink: number;
    };
    memberTagRemove: {
        width: number;
        height: number;
        borderRadius: number;
        alignItems: "center";
        justifyContent: "center";
        backgroundColor: string;
    };
    contactRowSelected: {
        backgroundColor: string;
    };
    dateSeparator: {
        alignSelf: "center";
        marginVertical: number;
        paddingHorizontal: number;
        paddingVertical: number;
        borderRadius: number;
        backgroundColor: string;
    };
    dateSeparatorText: {
        color: string;
        fontSize: 11;
        fontWeight: "600";
    };
    bubbleMetaRow: {
        flexDirection: "row";
        alignItems: "center";
        gap: number;
        marginTop: number;
        alignSelf: "flex-end";
    };
    bubbleTime: {
        color: string;
        fontSize: number;
    };
    bubbleTimeOwn: {
        color: string;
        fontSize: number;
    };
    editedLabel: {
        color: string;
        fontSize: number;
        fontStyle: "italic";
    };
    fileAttachment: {
        alignItems: "center";
        justifyContent: "center";
        gap: number;
        padding: number;
    };
    lightboxBackdrop: {
        flex: number;
        backgroundColor: string;
        justifyContent: "center";
        alignItems: "center";
    };
    lightboxClose: {
        position: "absolute";
        top: number;
        right: number;
        zIndex: number;
        padding: number;
    };
    lightboxImage: {
        width: "100%";
        height: "80%";
    };
    pendingAttachRow: {
        flexDirection: "row";
        flexWrap: "wrap";
        gap: number;
        paddingHorizontal: number;
        paddingTop: number;
        backgroundColor: string;
    };
    pendingAttachChip: {
        flexDirection: "row";
        alignItems: "center";
        gap: number;
        paddingLeft: number;
        paddingRight: number;
        paddingVertical: number;
        borderRadius: number;
        backgroundColor: string;
        borderWidth: number;
        borderColor: string;
    };
    tabUnreadBadge: {
        position: "absolute";
        top: number;
        right: number;
        minWidth: number;
        height: number;
        borderRadius: number;
        backgroundColor: string;
        alignItems: "center";
        justifyContent: "center";
        paddingHorizontal: number;
    };
    tabUnreadText: {
        color: string;
        fontSize: number;
        fontWeight: "700";
    };
};
//# sourceMappingURL=messagingStyles.d.ts.map