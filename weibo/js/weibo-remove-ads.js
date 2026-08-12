function isCommentAd(item) {
  return item?.type === 1 || Object.prototype.hasOwnProperty.call(item ?? {}, 'adType');
}

function isPseudoComment(item) {
  const screenName = item?.data?.user?.screen_name ?? item?.user?.screen_name;
  return screenName === '超话社区' || screenName === '微博视频';
}

function isCommentItem(item) {
  return !isCommentAd(item)
    && ![6, 15, 41].includes(item?.type)
    && !isPseudoComment(item);
}

function filterBuildComments(obj) {
  if (Array.isArray(obj?.datas)) {
    obj.datas = obj.datas.filter(isCommentItem);
  }

  if (Array.isArray(obj?.root_comments)) {
    obj.root_comments = obj.root_comments.filter(isCommentItem);
  }

  return obj;
}

const responseBody = $response?.body;

if (responseBody) {
  try {
    const body = JSON.parse(responseBody);

    if ($request?.url?.includes('comments/build_comments')) {
      filterBuildComments(body);
    }

    $done({ body: JSON.stringify(body) });
  } catch (_) {
    $done({});
  }
} else {
  $done({});
}
