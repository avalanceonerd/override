const url = $request?.url ?? '';
const responseBody = $response?.body;

const itemMenusConfig = {
  creatortypeask: false, mblog_menus_apeal: true, mblog_menus_avatar_widget: false,
  mblog_menus_bullet_shield: true, mblog_menus_card_bg: false, mblog_menus_comment_manager: true,
  mblog_menus_copy_url: true, mblog_menus_custom: false, mblog_menus_delete: true,
  mblog_menus_edit: true, mblog_menus_edit_history: true, mblog_menus_edit_video: true,
  mblog_menus_favorite: true, mblog_menus_follow: true, mblog_menus_home: false,
  mblog_menus_long_picture: true, mblog_menus_modify_visible: true, mblog_menus_novelty: false,
  mblog_menus_open_reward: false, mblog_menus_popularize: false, mblog_menus_promote: false,
  mblog_menus_report: true, mblog_menus_shield: true, mblog_menus_sticking: true,
  mblog_menus_video_feedback: false, mblog_menus_video_later: false,
};

function isFeedAd(data) {
  return data?.mblogtypename === '广告'
    || data?.mblogtypename === '热推'
    || data?.readtimetype === 'adMblog'
    || data?.promotion?.recommend === '广告'
    || data?.promotion?.recommend === '热推'
    || data?.promotion?.type?.includes('ad')
    || data?.content_auth_info?.content_auth_title === '广告'
    || data?.content_auth_info?.content_auth_title === '热推'
    || data?.ads_material_info?.is_ads === true;
}

function isCommentAd(item) {
  return item?.type === 1 || Object.prototype.hasOwnProperty.call(item ?? {}, 'adType');
}

function isPseudoComment(item) {
  const name = item?.data?.user?.screen_name ?? item?.data?.user?.name ?? item?.user?.screen_name ?? item?.user?.name;
  return name === '超话社区' || name === '微博视频';
}

function removeAvatar(data) {
  if (!data) return;
  ['block_card_bg', 'buttons', 'cardid', 'icons', 'mblog_buttons', 'pic_bg_new'].forEach((key) => delete data[key]);
  if (data.user) ['avatargj_id', 'avatar_extend_info', 'cardid', 'icons', 'mbtype'].forEach((key) => delete data.user[key]);
}

function removeFeedUi(data) {
  if (!data) return;
  removeAvatar(data);
  removeAvatar(data.retweeted_status);
  ['common_struct', 'comment_summary', 'extend_info', 'semantic_brand_params'].forEach((key) => delete data[key]);
}

function removeVoteInfo(data) {
  if (data?.page_info?.media_info) delete data.page_info.media_info.vote_info;
}

function cleanComment(item) {
  if (!item) return;
  removeAvatar(item.data ?? item);
  const data = item.data ?? item;
  ['comment_bubble', 'comment_bullet_screens_message', 'hot_icon', 'vip_button'].forEach((key) => delete data[key]);
}

function filterBuildComments(obj) {
  if (Array.isArray(obj?.datas)) obj.datas = obj.datas.filter((item) => {
    if (isCommentAd(item) || [6, 15, 41].includes(item?.type) || isPseudoComment(item)) return false;
    cleanComment(item); return true;
  });
  if (Array.isArray(obj?.root_comments)) obj.root_comments = obj.root_comments.filter((item) => {
    if (isCommentAd(item) || isPseudoComment(item)) return false;
    cleanComment(item); return true;
  });
  if (Array.isArray(obj?.comments)) obj.comments.forEach((item) => {
    if (item?.reply_comment) delete item.reply_comment.comment_badge;
    if (item?.user) delete item.user.icons;
  });
  if (obj?.rootComment) delete obj.rootComment.comment_bubble;
  removeVoteInfo(obj?.status);
}

function filterFeedItems(items, options = {}) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    const data = item?.data ?? item?.status;
    if (isFeedAd(data)) return false;
    if (item?.category && !['feed', 'dynamic', 'feedBiz'].includes(item.category)) return false;
    if (data) {
      removeFeedUi(data); removeVoteInfo(data);
      if (options.skipTitles && (data?.title?.structs || data?.screen_name_suffix_new?.[3]?.content === '快转了'
        || data?.title?.text?.includes('精选') || data?.user?.following === false)) return false;
      if (data?.user?.unfollowing_recom_switch === 1) data.user.unfollowing_recom_switch = 0;
      if (Array.isArray(data?.tag_struct)) data.tag_struct = [];
    }
    return true;
  });
}

function handleCardList(obj) {
  delete obj.top;
  if (!Array.isArray(obj?.cards)) return;
  obj.cards = obj.cards.filter((card) => {
    if (card?.card_group) {
      card.card_group = card.card_group.filter((group) => ![120, 145, 192, 6].includes(group?.card_type));
      card.card_group.forEach((group) => removeAvatar(group?.mblog));
      return true;
    }
    removeAvatar(card?.mblog);
    return ![17, 58].includes(card?.card_type);
  });
}

function handleProfileTimeline(obj) {
  if (obj?.loadedInfo) delete obj.loadedInfo.follow_guide_info;
  if (!Array.isArray(obj?.items)) return;
  obj.items = obj.items.filter((item) => {
    if (item?.data?.left_hint?.[0]?.content === '全部微博(0)' && item?.data?.card_type === 216) return false;
    if (/内容/.test(item?.data?.name ?? '') && item?.data?.card_type === 58) return false;
    if (item?.category === 'feed') return !isFeedAd(item.data) && (removeFeedUi(item.data), removeVoteInfo(item.data), !item.data?.source?.includes('生日动态'));
    if (item?.category !== 'group') return !(item?.category === 'card' && /没有公开博文，为你推荐以下精彩内容/.test(item?.data?.name ?? ''));
    if (item?.itemId?.includes('INTEREST_PEOPLE') || item?.profile_type_id === 'weibo_cardpics') return false;
    if (item?.header?.data) delete item.header.data.icon;
    if (Array.isArray(item?.items)) item.items = item.items.filter((child) => {
      if (child?.category === 'feed') return !isFeedAd(child.data) && (removeFeedUi(child.data), removeVoteInfo(child.data), true);
      if (child?.category === 'card') return ![10, 48, 176].includes(child?.data?.card_type);
      return true;
    });
    return true;
  });
}

function handleTopicTimeline(obj) {
  if (obj?.header?.data) delete obj.header.data.follow_guide_info;
  if (!Array.isArray(obj?.items)) return;
  obj.items = obj.items.filter((item) => {
    if (item?.category === 'feed') { removeAvatar(item.data); return !isFeedAd(item.data); }
    if (item?.category === 'card') return ![4, 197, 236, 1012].includes(item?.data?.card_type)
      && !(item?.data?.card_type === 22 && Object.hasOwn(item.data, 'card_ad_style'));
    if (item?.category !== 'group') return false;
    if (item?.style) delete item.style.topHover;
    if (item?.header?.arrayText?.contents?.length) return false;
    if (Array.isArray(item?.items)) item.items = item.items.filter((child) => {
      removeAvatar(child?.data); delete child?.data?.common_struct;
      return ![1008, 1024].includes(child?.data?.card_type);
    });
    return true;
  });
}

function handleSearch(obj) {
  if (Array.isArray(obj?.cards)) {
    if (Array.isArray(obj.cards[0]?.card_group)) obj.cards[0].card_group = obj.cards[0].card_group.filter((card) =>
      !(card?.actionlog?.ext?.includes('ads_word') || card?.itemid?.includes('t:51') || card?.itemid?.includes('ads_word')));
    obj.cards = obj.cards.filter((card) => !(card?.itemid?.includes('feed_-_invite') || card?.itemid?.includes('infeed_friends_recommend')
      || card?.itemid?.includes('infeed_may_interest_in') || card?.itemid?.includes('infeed_pagemanual3')
      || card?.itemid?.includes('infeed_weibo_mall') || isFeedAd(card?.mblog)));
  }
}

function handleSplash(obj) {
  for (const ad of obj?.ads ?? []) Object.assign(ad, { start_time: 3818332800, end_time: 3818419199, daily_display_cnt: 50, display_duration: 0 });
  for (const ad of obj?.ads?.creatives ?? []) Object.assign(ad, { start_time: 3818332800, end_time: 3818419199, daily_display_cnt: 50, display_duration: 0 });
  for (const ad of obj?.cached_ad?.ads ?? []) Object.assign(ad, { show_count: 50, duration: 0, start_date: 3818332800, end_date: 3818419199 });
}

function handle(obj) {
  if (url.includes('/2/cardlist')) handleCardList(obj);
  else if (url.includes('/2/checkin/show')) { obj.show = 0; obj.show_time = 0; }
  else if (url.includes('/2/client/publisher_list') && Array.isArray(obj?.elements)) obj.elements = obj.elements.filter((item) => ['写微博', '图片', '视频'].includes(item?.app_name));
  else if (url.includes('/2/comments/build_comments')) filterBuildComments(obj);
  else if (url.includes('/2/container/asyn') && Array.isArray(obj?.items)) obj.items = obj.items.filter((item) => !/infeed_may_interest_in/.test(item?.itemId ?? '') && item?.itemId !== null);
  else if (url.includes('/2/direct_messages/user_list') && Array.isArray(obj?.user_list)) obj.user_list = obj.user_list.filter((item) => !['活动通知', '闪聊'].includes(item?.user?.name));
  else if (url.includes('/2/flowlist')) {
    if (Array.isArray(obj?.items)) obj.items.forEach((item) => item?.items?.forEach((child) => { removeAvatar(child?.data); removeVoteInfo(child?.data); }));
    if (Array.isArray(obj?.channelInfo?.channels)) obj.channelInfo.channels = obj.channelInfo.channels.filter((item) => !/_selfrecomm|_chaohua/.test(item?.flowId ?? ''));
  }
  else if (url.includes('/2/messageflow/notice') && Array.isArray(obj?.messages)) obj.messages = obj.messages.filter((item) => !item?.msg_card?.ad_tag);
  else if (url.includes('/2/flowpage') && Array.isArray(obj?.items)) obj.items.forEach((item) => { if (Array.isArray(item?.items)) item.items = item.items.filter((child) => !child?.data?.promotion && !/_img_search_stick/.test(child?.data?.pic ?? '')); });
  else if (url.includes('/2/groups/allgroups/v2') && Array.isArray(obj?.pageDatas)) obj.pageDatas = obj.pageDatas.filter((item) => item?.pageDataType !== 'homeExtend');
  else if (url.includes('/2/page') || url.includes('/2/search/')) handleSearch(obj);
  else if (url.includes('/2/profile/container_timeline')) handleProfileTimeline(obj);
  else if ((url.includes('/2/profile/dealatt') || url.includes('/2/friendships/'))) { obj.cards = []; if (Array.isArray(obj?.toolbar_menus_new?.items)) obj.toolbar_menus_new.items = obj.toolbar_menus_new.items.filter((item) => item?.identifier !== 'recommend' && !/reward_/.test(item?.identifier ?? '')); }
  else if (url.includes('/2/profile/me') && Array.isArray(obj?.items)) {
    delete obj.vipHeaderBgImage;
    obj.items = obj.items.filter((item) => ['profileme_mine', '100505_-_top8', '100505_-_manage', '100505_-_manage2', '100505_-_chaohua', '100505_-_recentlyuser'].includes(item?.itemId));
    obj.items.forEach((item) => {
      if (item?.itemId === '100505_-_top8' && Array.isArray(item?.items)) item.items = item.items.filter((child) => ['100505_-_album', '100505_-_like', '100505_-_watchhistory', '100505_-_draft'].includes(child?.itemId));
      if (item?.itemId === '100505_-_manage') { delete item.style; delete item.images; }
      if (item?.itemId === '100505_-_manage2') { delete item.footer; delete item.body; }
    });
  }
  else if (url.includes('/2/profile/statuses/tab') && Array.isArray(obj?.cards)) obj.cards.forEach((card) => card?.card_group?.forEach((group) => { removeAvatar(group?.mblog); removeVoteInfo(group?.mblog); }));
  else if (url.includes('/2/statuses/comments_expand_child') && Array.isArray(obj?.items)) obj.items.forEach((item) => removeAvatar(item?.data));
  else if (url.includes('/2/statuses/container_detail_comment') && Array.isArray(obj?.items)) obj.items = obj.items.filter((item) => {
    if (['trend', 'comment_header_tip'].includes(item?.type) || item?.data?.card_type === 236 || item?.data?.itemid === 'ai_summary_entrance_real_show') return false;
    cleanComment(item); item?.items?.forEach(cleanComment); return true;
  });
  else if (url.includes('/2/statuses/container_detail?')) { if (Array.isArray(obj?.pageHeader?.data?.items)) obj.pageHeader.data.items = obj.pageHeader.data.items.filter((item) => !(item?.data?.is_ad_card === 1 || item?.data?.card_type === 227 || item?.data?.card_type === 236 || item?.data?.itemid === 'top_searching')); ['ai_search_share', 'follow_data', 'reward_info', 'sharecontent'].forEach((key) => delete obj?.detailInfo?.extend?.[key]); delete obj?.detailInfo?.status?.reward_info; }
  else if (url.includes('/2/statuses/container_timeline_topic')) handleTopicTimeline(obj);
  else if (url.includes('/2/statuses/container_timeline_hot') || url.includes('/2/statuses/unread_hot_timeline')) { ['ad', 'advertises', 'trends', 'headers'].forEach((key) => delete obj[key]); obj.items = filterFeedItems(obj.items); if (Array.isArray(obj?.statuses)) obj.statuses = obj.statuses.filter((item) => !isFeedAd(item)).map((item) => (removeFeedUi(item), item)); }
  else if (url.includes('/2/statuses/container_timeline') || url.includes('/2/statuses/unread_hot_timeline')) { delete obj?.loadedInfo?.headers; delete obj.common_struct; obj.items = filterFeedItems(obj.items, { skipTitles: true }); }
  else if (url.includes('/2/statuses/repost_timeline')) { if (Array.isArray(obj?.hot_reposts)) obj.hot_reposts = obj.hot_reposts.filter((item) => !isFeedAd(item)); if (Array.isArray(obj?.reposts)) obj.reposts = obj.reposts.filter((item) => !isFeedAd(item)); }
  else if (url.includes('/2/statuses/show')) { removeFeedUi(obj); removeFeedUi(obj.text); removeVoteInfo(obj); delete obj.reward_info; }
  else if (url.includes('/2/statuses/extend')) { ['bubble_guide_data', 'button_extra_info', 'display_info', 'extend_info', 'floating_button', 'follow_data', 'head_cards', 'highlight', 'interaction_extra_info', 'page_alerts', 'reward_info', 'source_tag_struct', 'top_cards'].forEach((key) => delete obj[key]); if (Array.isArray(obj?.custom_action_list)) obj.custom_action_list = obj.custom_action_list.filter((item) => itemMenusConfig[item?.type]); obj.has_common_struct = false; obj.enable_comment_guide = false; }
  else if (url.includes('/2/video/full_screen_stream') && Array.isArray(obj?.statuses)) obj.statuses = obj.statuses.filter((item) => !isFeedAd(item)).map((item) => { removeAvatar(item); if (item?.video_info) item.video_info.tags = []; return item; });
  else if (url.includes('/2/video/tiny_stream_mid_detail')) { if (obj?.status?.video_info) { obj.status.video_info.shopping = []; obj.status.video_info.bottom_banner = {}; obj.status.video_info.float_info = {}; } }
  else if (url.includes('/2/video/tiny_stream_video_list')) { obj.statuses = []; obj.tab_list = []; }
  else if (url.includes('/2/!/huati/discovery_home_bottom_channels')) { delete obj.button_configs; if (Array.isArray(obj?.channelInfo?.channel_list)) obj.channelInfo.channel_list = obj.channelInfo.channel_list.filter((item) => item?.title !== '广场'); }
  else if (url.includes('/2/shproxy/chaohua/discovery/searchactive') && Array.isArray(obj?.items)) obj.items = obj.items.filter((item) => item?.data?.card_type !== 1007);
  else if (url.includes('/v1/ad/preload') || url.includes('/v2/ad/preload') || url.includes('/wbapplua/wbpullad.lua') || url.includes('/preload/get_ad')) handleSplash(obj);
}

if (!responseBody) $done({});
else {
  const sdkAd = url.includes('/interface/sdk/sdkad.php');
  const jsonBody = sdkAd && responseBody.endsWith('OK') ? responseBody.slice(0, -2) : responseBody;
  try {
    const body = JSON.parse(jsonBody);
    if (sdkAd) {
      body.needlocation = false; body.show_push_splash_ad = false;
      ['background_delay_display_time', 'lastAdShow_delay_display_time'].forEach((key) => body[key] = 31536000);
      ['realtime_ad_video_stall_time', 'realtime_ad_timeout_duration'].forEach((key) => body[key] = 0);
      for (const ad of body?.ads ?? []) Object.assign(ad, { displaytime: 0, displayintervel: 31536000, allowdaydisplaynum: 0, begintime: '2040-01-01 00:00:00', endtime: '2040-01-01 23:59:59' });
    } else handle(body);
    $done({ body: JSON.stringify(body) + (sdkAd ? 'OK' : '') });
  } catch (_) {
    $done({ body: responseBody });
  }
}
